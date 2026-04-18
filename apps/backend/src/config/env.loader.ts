import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';

const loaded = { value: false };

export function loadEnvironment(): void {
  if (loaded.value) {
    return;
  }

  const cwd = process.cwd();
  const monorepoRoot = path.resolve(cwd, '../../');

  const envCandidates = [
    path.join(monorepoRoot, '.env'),
    path.join(monorepoRoot, '.env.local'),
    path.join(cwd, '.env'),
    path.join(cwd, '.env.local'),
  ];

  for (const envPath of envCandidates) {
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath, override: false });
    }
  }

  loaded.value = true;
}
