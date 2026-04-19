import { DynamicModule, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserEntity } from './entities/user.entity';
import { UserSessionEntity } from './entities/user-session.entity';
import { GoogleGmailConnectionEntity } from './entities/google-gmail-connection.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { isDatabaseEnabled } from '../database/database.module';

@Module({})
export class AuthModule {
  static register(): DynamicModule {
    if (!isDatabaseEnabled()) {
      Logger.warn(
        'AuthModule is disabled because database integration is not enabled.',
        AuthModule.name,
      );

      return {
        module: AuthModule,
      };
    }

    return {
      module: AuthModule,
      imports: [
        TypeOrmModule.forFeature([
          UserEntity,
          UserSessionEntity,
          GoogleGmailConnectionEntity,
        ]),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [AuthService, JwtAuthGuard, RolesGuard],
      exports: [AuthService],
    };
  }
}
