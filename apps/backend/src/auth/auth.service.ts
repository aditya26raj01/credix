import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { GoogleGmailConnectDto } from './dto/google-gmail-connect.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserEntity } from './entities/user.entity';
import { UserSessionEntity } from './entities/user-session.entity';
import { GoogleGmailConnectionEntity } from './entities/google-gmail-connection.entity';
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

export interface GoogleGmailConnectionStatusResponse {
  connected: boolean;
  email: string | null;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  connectedAt: Date | null;
  scopes: string[];
}

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity)
    private readonly sessionsRepository: Repository<UserSessionEntity>,
    @InjectRepository(GoogleGmailConnectionEntity)
    private readonly gmailConnectionsRepository: Repository<GoogleGmailConnectionEntity>,
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

  async getGoogleGmailConnection(
    userId: string,
  ): Promise<GoogleGmailConnectionStatusResponse> {
    const connection = await this.gmailConnectionsRepository.findOne({
      where: { userId },
    });

    if (!connection || !connection.connectedAt || connection.disconnectedAt) {
      return {
        connected: false,
        email: null,
        lastSyncAt: null,
        nextSyncAt: null,
        connectedAt: null,
        scopes: [],
      };
    }

    return {
      connected: true,
      email: connection.gmailEmail,
      lastSyncAt: connection.lastSyncAt,
      nextSyncAt: connection.nextSyncAt,
      connectedAt: connection.connectedAt,
      scopes: connection.scopes,
    };
  }

  async connectGoogleGmail(
    userId: string,
    dto: GoogleGmailConnectDto,
  ): Promise<GoogleGmailConnectionStatusResponse> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const clientId = this.getRequiredEnv('GOOGLE_CLIENT_ID');
    const clientSecret = this.getRequiredEnv('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      dto.redirectUri ?? process.env.GOOGLE_GMAIL_REDIRECT_URI;

    if (!redirectUri) {
      throw new InternalServerErrorException(
        'GOOGLE_GMAIL_REDIRECT_URI is not configured',
      );
    }

    const oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);

    let tokenResponse;
    try {
      tokenResponse = await oauthClient.getToken({
        code: dto.code,
        redirect_uri: redirectUri,
        codeVerifier: dto.codeVerifier,
      });
    } catch {
      throw new BadRequestException('Failed to exchange Google OAuth code');
    }

    const tokens = tokenResponse.tokens;
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return refresh token. Request consent with prompt=consent and access_type=offline.',
      );
    }

    const scopes = this.parseScopes(tokens.scope);
    const hasGmailReadonly = scopes.includes(
      'https://www.googleapis.com/auth/gmail.readonly',
    );

    if (!hasGmailReadonly) {
      throw new BadRequestException(
        'Missing gmail.readonly scope in Google OAuth grant',
      );
    }

    const now = new Date();
    const nextSyncAt = this.calculateNextSync(now);

    let connection = await this.gmailConnectionsRepository.findOne({
      where: { userId },
    });

    if (!connection) {
      connection = this.gmailConnectionsRepository.create({
        userId,
        gmailEmail: user.email,
        scopes,
        refreshTokenEncrypted: this.encryptSensitiveValue(tokens.refresh_token),
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        connectedAt: now,
        disconnectedAt: null,
        lastSyncAt: null,
        nextSyncAt,
      });
    } else {
      connection.gmailEmail = user.email;
      connection.scopes = scopes;
      connection.refreshTokenEncrypted = this.encryptSensitiveValue(
        tokens.refresh_token,
      );
      connection.accessTokenExpiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : connection.accessTokenExpiresAt;
      connection.connectedAt = now;
      connection.disconnectedAt = null;
      connection.nextSyncAt = nextSyncAt;
    }

    connection = await this.gmailConnectionsRepository.save(connection);

    return {
      connected: true,
      email: connection.gmailEmail,
      lastSyncAt: connection.lastSyncAt,
      nextSyncAt: connection.nextSyncAt,
      connectedAt: connection.connectedAt,
      scopes: connection.scopes,
    };
  }

  async disconnectGoogleGmail(userId: string): Promise<{ success: true }> {
    const connection = await this.gmailConnectionsRepository.findOne({
      where: { userId },
    });

    if (!connection) {
      return { success: true };
    }

    connection.disconnectedAt = new Date();
    connection.connectedAt = null;
    connection.lastSyncAt = null;
    connection.nextSyncAt = null;
    connection.scopes = [];
    connection.refreshTokenEncrypted = this.encryptSensitiveValue(
      `revoked:${randomBytes(16).toString('hex')}`,
    );

    await this.gmailConnectionsRepository.save(connection);
    return { success: true };
  }

  async syncGoogleGmailNow(
    userId: string,
  ): Promise<GoogleGmailConnectionStatusResponse> {
    const connection = await this.gmailConnectionsRepository.findOne({
      where: { userId },
    });

    if (!connection || !connection.connectedAt || connection.disconnectedAt) {
      throw new NotFoundException('Google Gmail connection not found');
    }

    const now = new Date();
    connection.lastSyncAt = now;
    connection.nextSyncAt = this.calculateNextSync(now);

    await this.gmailConnectionsRepository.save(connection);

    return {
      connected: true,
      email: connection.gmailEmail,
      lastSyncAt: connection.lastSyncAt,
      nextSyncAt: connection.nextSyncAt,
      connectedAt: connection.connectedAt,
      scopes: connection.scopes,
    };
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

  private parseScopes(scopeValue: string | null | undefined): string[] {
    if (!scopeValue) {
      return [];
    }

    return scopeValue
      .split(' ')
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private encryptSensitiveValue(value: string): string {
    const keyRaw = this.getRequiredEnv('OAUTH_TOKEN_ENCRYPTION_KEY');
    const key = this.normalizeEncryptionKey(keyRaw);
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private normalizeEncryptionKey(keyRaw: string): Buffer {
    const trimmed = keyRaw.trim();

    if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }

    const base64Buffer = Buffer.from(trimmed, 'base64');
    if (base64Buffer.length === 32) {
      return base64Buffer;
    }

    const utf8Buffer = Buffer.from(trimmed, 'utf8');
    if (utf8Buffer.length === 32) {
      return utf8Buffer;
    }

    throw new InternalServerErrorException(
      'OAUTH_TOKEN_ENCRYPTION_KEY must be 32-byte utf8, 64-char hex, or base64 for 32 bytes',
    );
  }

  private calculateNextSync(from: Date): Date {
    const date = new Date(from);
    date.setDate(date.getDate() + 1);
    return date;
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
