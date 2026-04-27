import path from 'path';
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import sensible from '@fastify/sensible';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';

import isProd from './env/isProd.js';
import { getSecret } from './env/getSecret.js';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';

export function buildApp() {
  const app = Fastify({ logger: true });

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
  app.register(prismaPlugin);
  app.register(authPlugin);
  app.register(sensible);
  app.register(autoload, {
    prefix: '/api/v1',
    dir: path.join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    matchFilter: (path) => /index\.(js|ts)$/.test(path),
  });

  return app;
}
