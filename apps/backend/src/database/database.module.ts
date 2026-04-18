import { DynamicModule, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildPostgresTypeOrmConfig } from './postgres.config';

export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.NODE_ENV !== 'test';
}

@Module({})
export class DatabaseModule {
  static register(): DynamicModule {
    const databaseUrl = process.env.DATABASE_URL;

    if (!isDatabaseEnabled()) {
      const reason = !databaseUrl
        ? 'DATABASE_URL is not set'
        : 'NODE_ENV is test';

      Logger.warn(
        `${reason}. Postgres connection is disabled.`,
        DatabaseModule.name,
      );

      return {
        module: DatabaseModule,
      };
    }

    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRoot(buildPostgresTypeOrmConfig(databaseUrl!)),
      ],
    };
  }
}
