import { Request } from 'express';
import { UserRole } from '../entities/user.entity';

export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}
