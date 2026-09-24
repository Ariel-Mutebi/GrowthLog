import z from 'zod';
import { loadEnvFile } from './load.js';
import { envDefinitions } from './definitions.js';
import type { EnvKey, EnvValues } from './definitions.js';

export function loadEnv<K extends EnvKey, O extends Record<string, string> = Record<string, never>>(
  keys: readonly K[],
  overrides: O = {} as O,
): EnvValues<K> & O {
  loadEnvFile();

  type Subset = {
    [P in K]: (typeof envDefinitions)[P];
  };

  const subset = Object.fromEntries(keys.map((key) => [key, envDefinitions[key]])) as Subset;
  const schema = z.object(subset);

  const candidate: Record<string, unknown> = { ...keys, ...overrides };
  const { data: validated, success, error } = schema.safeParse(candidate);

  if (!success) {
    throw new Error(`Invalid environment configuration:\n  ${
      error.issues.map((issue) => `${issue.path.join('')}: ${issue.message}`).join('\n')
    }`);
  }

  const complement = Object.fromEntries(
    Object.entries(overrides).filter(([key]) => !(key in subset)),
  );

  return { ...validated, complement } as EnvValues<K> & O;
}
