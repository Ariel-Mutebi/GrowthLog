import { z } from 'zod';

const hexSecret = (length: number) =>
  z.string().length(length).regex(new RegExp(`^[0-9a-f]{${length}}$`));

export const envDefinitions = {
  API_PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  WS_PORT: z.coerce.number().int().min(0).max(65535).default(1234),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: hexSecret(64),
  JWT_SECRET: hexSecret(64),
  REDIS_URL: z.string().regex(/^redis(s)?:\/\/S+/),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/S+/),
} satisfies Record<string, z.ZodTypeAny>;

export type EnvKey = keyof typeof envDefinitions;
export type EnvValues<K extends EnvKey> = Pick<{ [P in EnvKey]: z.infer<(typeof envDefinitions)[P]> }, K>;
