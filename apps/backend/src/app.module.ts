import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadEnvironment } from './config/env.loader';
import { DatabaseModule } from './database/database.module';

loadEnvironment();

@Module({
  imports: [DatabaseModule.register()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
