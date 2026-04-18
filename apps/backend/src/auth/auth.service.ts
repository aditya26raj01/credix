import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserEntity } from './entities/user.entity';
import { UserSessionEntity } from './entities/user-session.entity';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/auth-jwt-payload';

export interface AuthUserResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserEntity['role'];
}

export interface SessionTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthUserResponse;
}

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity)
    private readonly sessionsRepository: Repository<UserSessionEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async exchangeGoogleIdToken(
    dto: GoogleExchangeDto,
  ): Promise<SessionTokensResponse> {
    const audience = this.getRequiredEnv('GOOGLE_CLIENT_ID');
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException(
        'Google token is missing required claims',
      );
    }

    let user = await this.usersRepository.findOne({
      where: { providerSubject: payload.sub },
    });

    if (!user) {
      user = await this.usersRepository.findOne({
        where: { email: payload.email },
      });
    }

    if (!user) {
      user = this.usersRepository.create({
        email: payload.email,
        displayName: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
        provider: 'google',
        providerSubject: payload.sub,
      });
    } else {
      user.email = payload.email;
      user.displayName = payload.name ?? user.displayName;
      user.avatarUrl = payload.picture ?? user.avatarUrl;
      user.provider = 'google';
      user.providerSubject = payload.sub;
    }

    user = await this.usersRepository.save(user);

    return this.issueSessionTokens(user, dto.deviceInfo ?? null);
  }

  async refreshSession(dto: RefreshTokenDto): Promise<SessionTokensResponse> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    const session = await this.sessionsRepository.findOne({
      where: { id: payload.sessionId },
      relations: ['user'],
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session not found');
    }

    const now = new Date();
    if (session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException('Session is no longer active');
    }

    if (session.refreshTokenHash !== this.hashToken(dto.refreshToken)) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    return this.rotateSessionTokens(session);
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: true }> {
    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
      const session = await this.sessionsRepository.findOne({
        where: { id: payload.sessionId },
      });

      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await this.sessionsRepository.save(session);
      }
    } catch {
      return { success: true };
    }

    return { success: true };
  }

  async getMe(userId: string): Promise<AuthUserResponse> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toAuthUser(user);
  }

  private async issueSessionTokens(
    user: UserEntity,
    deviceInfo: string | null,
  ): Promise<SessionTokensResponse> {
    const refreshExpiry = this.getRefreshExpiryDate();

    let session = this.sessionsRepository.create({
      userId: user.id,
      refreshTokenHash: 'pending',
      expiresAt: refreshExpiry,
      revokedAt: null,
      deviceInfo,
    });

    session = await this.sessionsRepository.save(session);

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      sessionId: session.id,
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.getRequiredEnv('JWT_REFRESH_SECRET'),
      expiresIn: this.getRefreshTtlSeconds(),
    });

    session.refreshTokenHash = this.hashToken(refreshToken);
    session.expiresAt = refreshExpiry;
    session = await this.sessionsRepository.save(session);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      sessionId: session.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.getRequiredEnv('JWT_ACCESS_SECRET'),
      expiresIn: this.getAccessTtlSeconds(),
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.getAccessTtlSeconds(),
      user: this.toAuthUser(user),
    };
  }

  private async rotateSessionTokens(
    session: UserSessionEntity,
  ): Promise<SessionTokensResponse> {
    const refreshExpiry = this.getRefreshExpiryDate();

    const refreshPayload: RefreshTokenPayload = {
      sub: session.userId,
      sessionId: session.id,
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.getRequiredEnv('JWT_REFRESH_SECRET'),
      expiresIn: this.getRefreshTtlSeconds(),
    });

    session.refreshTokenHash = this.hashToken(refreshToken);
    session.expiresAt = refreshExpiry;
    session.revokedAt = null;
    await this.sessionsRepository.save(session);

    const accessPayload: AccessTokenPayload = {
      sub: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      role: session.user.role,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.getRequiredEnv('JWT_ACCESS_SECRET'),
      expiresIn: this.getAccessTtlSeconds(),
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.getAccessTtlSeconds(),
      user: this.toAuthUser(session.user),
    };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.getRequiredEnv('JWT_REFRESH_SECRET'),
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }
    return value;
  }

  private getAccessTtlSeconds(): number {
    const ttl = (process.env.JWT_ACCESS_TTL ?? '15m').trim();
    const match = ttl.match(/^(\d+)(s|m|h|d)$/i);

    if (!match) {
      return 15 * 60;
    }

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 's') {
      return value;
    }
    if (unit === 'm') {
      return value * 60;
    }
    if (unit === 'h') {
      return value * 60 * 60;
    }
    return value * 60 * 60 * 24;
  }

  private getRefreshTtlDays(): number {
    const raw = process.env.REFRESH_TOKEN_TTL_DAYS;
    const parsed = raw ? Number(raw) : NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 30;
    }

    return Math.floor(parsed);
  }

  private getRefreshExpiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + this.getRefreshTtlDays());
    return date;
  }

  private getRefreshTtlSeconds(): number {
    return this.getRefreshTtlDays() * 24 * 60 * 60;
  }

  private toAuthUser(user: UserEntity): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}
