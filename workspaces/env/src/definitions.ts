import { z } from 'zod';

// You can generate a secret using: openssl rand -hex 32
const hexSecret = (length: number) =>
  z.string().length(length).regex(new RegExp(`^[0-9a-f]{${length}}$`));

const port = z.coerce.number().int().min(0).max(65535);
const positive = z.coerce.number().positive();

export const envDefinitions = {
  API_PORT: port,
  DOCS_PORT: port,
  IMAGES_PORT: port,
  NODE_ENV: z.enum(['development', 'production', 'test']),

  SESSION_SECRET: hexSecret(64),
  JWT_SECRET: hexSecret(64),
  REDIS_URL: z.url().regex(/^redis(s)?:\/\/\S+/),
  DATABASE_URL: z.url().regex(/^postgres(ql)?:\/\/\S+/),

  MINIO_INTERNAL_ENDPOINT: z.url().regex(/^https?:\/\/\S+/),
  MINIO_PUBLIC_ENDPOINT: z.url().regex(/^https?:\/\/\S+/),
  MINIO_ROOT_USER: hexSecret(64),
  MINIO_ROOT_PASSWORD: hexSecret(64),
  MINIO_AVATAR_BUCKET: z.string(),
  MAX_AVATAR_SIZE_BYTES: positive,
  PRESIGNED_URL_EXPIRY_SECONDS: positive,
} satisfies Record<string, z.ZodType>;

export type EnvKey = keyof typeof envDefinitions;
export type EnvValues<K extends EnvKey> = Pick<{ [P in EnvKey]: z.infer<(typeof envDefinitions)[P]> }, K>;
