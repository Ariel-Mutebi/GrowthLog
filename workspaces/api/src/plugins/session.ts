import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import { RedisStore } from 'connect-redis';

export const sessionPlugin = fp(async (app) => {
  app.register(fastifySession, {
    secret: app.config.SESSION_SECRET,
    saveUninitialized: false,
    store: new RedisStore({
      client: app.redis,
      prefix: app.config.REDIS_KEY_PREFIX ?? '',
    }),
    cookie: {
      secure: app.config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600 * 1000,
    },
  });
});
