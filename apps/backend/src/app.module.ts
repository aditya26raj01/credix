import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadEnvironment } from './config/env.loader';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

loadEnvironment();

@Module({
  imports: [DatabaseModule.register(), AuthModule.register()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
