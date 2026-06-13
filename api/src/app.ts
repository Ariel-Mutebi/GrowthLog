import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redisPlugin } from './plugins/redis.js';
import { sessionPlugin } from './plugins/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // DOS hardening: per-IP rate-limiting (per-server as redis not used)
  app.register(fastifyRateLimit, {
    max: 60,
    timeWindow: '1 minute',
  });

  app.register(fastifyHelmet);
  app.register(fastifyCookie);
  app.register(redisPlugin);
  app.register(sessionPlugin);
  app.register(prismaPlugin);
  app.register(authPlugin);

  /**
   * Load routers from ./routes using autoload, with sub-folder names becoming endpoints.
   * Note: autoload only picks up default exports.
   */
  app.register(autoload, {
    dir: path.join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    options: {
      prefix: 'v1/',
    },
    matchFilter: (path) => /Router\.(ts|js)$/.test(path),
  });


  app.ready(() => {
    console.log(app.printRoutes());
  });

  return app;
}
