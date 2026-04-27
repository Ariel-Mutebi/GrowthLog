import path from 'path';
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyRateLimit from '@fastify/rate-limit';

import isProd from './env/isProd.js';
import { getSecret } from './env/getSecret.js';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  // basic protection against DOS, brute-forcing log-ins
  app.register(fastifyRateLimit, {
    max: 60,
    timeWindow: '1 minute',
  });

  // basic security, cookie-based session management
  app.register(fastifyHelmet);
  app.register(fastifyCookie);
  app.register(fastifySession, {
    secret: getSecret(),
    cookie: {
      secure: isProd(),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  });

  // custom plugins
  app.register(prismaPlugin);
  app.register(authPlugin);

  // load routers
  app.register(autoload, {
    prefix: '/api/v1',
    dir: path.join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    matchFilter: (path) => /index\.(js|ts)$/.test(path),
  });

  return app;
}
