import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { EnvSchema, type Env } from '../typebox/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ajv = addFormats(
  new Ajv({
    allErrors: true,
    coerceTypes: true,
    useDefaults: true,
  }),
  ['uri'],
);

const validate = ajv.compile(EnvSchema);

/**
 * Loads .env into process.env for local dev. In prod, real env vars are
 * expected to already be set by the deploy environment, so this is a no-op.
 */
export function loadEnv(path = join(__dirname, '../../../.env')): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

/**
 * Builds and validates config. `overrides` take precedence over process.env,
 * so tests can pass exact values without touching process.env at all.
 */
export function loadConfig(overrides: EnvOverrides = {}): Env {
  const candidate: Record<string, unknown> = { ...process.env, ...overrides };

  if (!validate(candidate)) {
    const details = ajv.errorsText(validate.errors, { separator: '\n  ' });
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }

  return candidate as Env;
}

export type EnvOverrides = Partial<Record<keyof Env, string>>;
