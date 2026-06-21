import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import { RedisStore } from 'connect-redis';

export const sessionPlugin = fp(async (app) => {
  app.register(fastifySession, {
    secret: process.env.SESSION_SECRET!,
    saveUninitialized: false,
    store: new RedisStore({
      client: app.redis,
      prefix: `${process.env.REDIS_KEY_PREFIX ?? ''}session:`, // see ../utils/redis.ts
    }),
    cookie: {
      secure: process.env.NODE_ENV !== 'test',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600 * 1000, // 1 month
    },
  });
});
