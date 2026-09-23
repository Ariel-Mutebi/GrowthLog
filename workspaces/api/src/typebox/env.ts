import { Type, type Static } from '@sinclair/typebox';

export const EnvSchema = Type.Object({
  PORT: Type.Number({
    default: 3000,
    minimum: 0,
    maximum: 65535,
  }),

  NODE_ENV: Type.Union(
    [
      Type.Literal('development'),
      Type.Literal('production'),
      Type.Literal('test'),
    ],
    { default: 'development' },
  ),

  REDIS_URL: Type.String({
    format: 'uri',
    pattern: '^redis(s)?://',
  }),

  SESSION_SECRET: Type.String({
    minLength: 64,
    maxLength: 64,
    pattern: '^[0-9a-f]{64}$',
  }),

  JWT_SECRET: Type.String({
    minLength: 64,
    maxLength: 64,
    pattern: '^[0-9a-f]{64}$',
  }),

  DATABASE_URL: Type.String({
    format: 'uri',
    pattern: '^postgres(ql)?://',
  }),

  // for isolation between test files
  REDIS_KEY_PREFIX: Type.String({ default: '' }),
});

export type Env = Static<typeof EnvSchema>;
