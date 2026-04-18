import { DynamicModule, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildPostgresTypeOrmConfig } from './postgres.config';

@Module({})
export class DatabaseModule {
  static register(): DynamicModule {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      Logger.warn(
        'DATABASE_URL is not set. Postgres connection is disabled.',
        DatabaseModule.name,
      );

      return {
        module: DatabaseModule,
      };
    }

    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forRoot(buildPostgresTypeOrmConfig(databaseUrl))],
    };
  }
}
