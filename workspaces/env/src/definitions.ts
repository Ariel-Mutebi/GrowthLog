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

  STORAGE_ENDPOINT: z.url().regex(/^https?:\/\/\S+/),
  STORAGE_ACCESS_KEY_ID: hexSecret(64),
  STORAGE_SECRET_ACCESS_KEY: hexSecret(64),
  STORAGE_REGION: z.string().min(1),
  PRESIGNED_URL_EXPIRY_SECONDS: positive,

  PUBLIC_STORAGE_ENDPOINT: z.url().regex(/^https?:\/\/\S+/),
  PUBLIC_AVATAR_BUCKET: z.string(),
  PUBLIC_IMAGE_BUCKET: z.string(),
  PUBLIC_MAX_AVATAR_SIZE_BYTES: positive,
  PUBLIC_MAX_IMAGE_SIZE_BYTES: positive,

  SMTP_HOST: z.string(),
  SMTP_PORT: port,
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  FROM_EMAIL: z.string(),
} satisfies Record<string, z.ZodType>;

export type EnvKey = keyof typeof envDefinitions;
export type EnvValues<K extends EnvKey> = Pick<{ [P in EnvKey]: z.infer<(typeof envDefinitions)[P]> }, K>;
