import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthUserResponse, SessionTokensResponse } from './auth.service';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import type { AuthenticatedRequest } from './types/auth-jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google/exchange')
  exchangeGoogleIdToken(
    @Body() dto: GoogleExchangeDto,
  ): Promise<SessionTokensResponse> {
    return this.authService.exchangeGoogleIdToken(dto);
  }

  @Post('refresh')
  refreshSession(@Body() dto: RefreshTokenDto): Promise<SessionTokensResponse> {
    return this.authService.refreshSession(dto);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto): Promise<{ success: true }> {
    return this.authService.logout(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: AuthenticatedRequest): Promise<AuthUserResponse> {
    return this.authService.getMe(req.user!.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/check')
  adminCheck() {
    return { ok: true };
  }
}
