import { TypeOrmModuleOptions } from '@nestjs/typeorm';

type SslEnvValue = 'true' | 'false' | '1' | '0' | 'require';

function parseBool(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase() as SslEnvValue;

  if (normalized === 'true' || normalized === '1' || normalized === 'require') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return undefined;
}

function isLocalDatabaseHost(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

export function buildPostgresTypeOrmConfig(
  databaseUrl: string,
): TypeOrmModuleOptions {
  const explicitSsl = parseBool(process.env.DB_SSL);
  const explicitRejectUnauthorized = parseBool(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
  );

  const shouldUseSsl = explicitSsl ?? !isLocalDatabaseHost(databaseUrl);
  const rejectUnauthorized = explicitRejectUnauthorized ?? true;

  return {
    type: 'postgres',
    url: databaseUrl,
    autoLoadEntities: true,
    synchronize: process.env.NODE_ENV === 'development',
    ssl: shouldUseSsl ? { rejectUnauthorized } : false,
    logging: process.env.NODE_ENV === 'development',
  };
}
