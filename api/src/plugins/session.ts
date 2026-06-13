import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import { RedisStore } from 'connect-redis';

export const sessionPlugin = fp(async (app) => {
  app.register(fastifySession, {
    secret: process.env.SESSION_SECRET!,
    store: new RedisStore({
      client: app.redis,
      prefix: 'session:',
    }),
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 1 month
    },
  });
});
