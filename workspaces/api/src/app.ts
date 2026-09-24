import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { loadEnv } from '@growthlog/env';
import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { sessionPlugin } from './plugins/session.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { rateLimitPlugin } from './plugins/rate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Overrides for per-test isolation
type Overrides = Partial<{
  REDIS_URL: string;
  DATABASE_URL: string;
  REDIS_KEY_PREFIX: string;
}>;

export function buildApp(overrides?: Overrides) {
  const app = Fastify({
    logger: {
      level: 'warn',
    },
    trustProxy: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  const config = loadEnv(
    [
      'API_PORT',
      'NODE_ENV',
      'REDIS_URL',
      'SESSION_SECRET',
      'JWT_SECRET',
      'DATABASE_URL',
    ],
    overrides,
  );

  app.decorate('config', config);
  app.register(fastifyHelmet);
  app.register(fastifyCookie);
  app.register(redisPlugin);
  app.register(rateLimitPlugin);
  app.register(sessionPlugin);
  app.register(prismaPlugin);
  app.register(authPlugin);
  app.register(swaggerPlugin);

  /**
   * Auto-register all default-exported routers within the `routes` directory
   * tree under the `/api` namespace, using directory names as route prefixes.
   */
  app.register(autoload, {
    dir: join(__dirname, './routes'),
    dirNameRoutePrefix: true,
    options: { prefix: 'api/' },
  });

  app.ready(() => {    
    if (app.config.NODE_ENV === 'development') {
      console.log(app.printRoutes());
    }
  });

  return app;
}
