import fp from 'fastify-plugin';
import session from '@fastify/session';
import { RedisStore } from 'connect-redis';

export const sessionPlugin = fp(async (app) => {
  const isProd = app.config.NODE_ENV === 'production';

  app.register(session, {
    secret: app.config.SESSION_SECRET,
    saveUninitialized: false,
    store: new RedisStore({
      client: app.redis,
      prefix: app.config.REDIS_KEY_PREFIX ?? '',
    }),
    cookie: {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'strict',
      maxAge: 30 * 24 * 3600 * 1000,
      ...(isProd && { domain: '.growthlog.fyi' }),
    },
  });
});
