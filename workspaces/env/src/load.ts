import { findUpSync } from 'find-up';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function loadEnvFile() {
  const workspaceFile = findUpSync('pnpm-workspace.yaml');
  if (!workspaceFile) return;

  const envPath = join(dirname(workspaceFile), '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}
