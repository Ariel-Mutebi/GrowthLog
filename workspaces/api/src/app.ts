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
import { queuesPlugin } from './plugins/queues.js';
import type { Config } from './types/config.js';
import { errorHandler } from './utils/errorHandler.js';
import { healthPlugin } from './plugins/health.js';
import { underPressurePlugin } from './plugins/pressure.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function buildApp(overrides: Config) {
  const config = loadEnv([
    'API_PORT',
    'NODE_ENV',
    'REDIS_URL',
    'SESSION_SECRET',
    'JWT_SECRET',
    'DATABASE_URL',
    'PUBLIC_STORAGE_ENDPOINT',
    'PUBLIC_IMAGE_BUCKET',
  ], overrides as object as Record<string, string>);

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'warn' : 'info',
    },
    trustProxy: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.decorate('config', config);
  app.register(fastifyHelmet);
  app.register(fastifyCookie);
  app.register(underPressurePlugin);
  app.register(redisPlugin);
  app.register(prismaPlugin);
  app.register(healthPlugin);

  app.register(rateLimitPlugin);
  app.register(sessionPlugin);
  app.register(authPlugin);
  app.register(queuesPlugin);
  app.register(swaggerPlugin);

  /**
   * Auto-register all default-exported routers within the `routes` directory
   * tree under the `/api` namespace, using directory names as route prefixes.
   */
  app.register(autoload, {
    dir: join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    options: { prefix: 'api/' },
    routeParams: true,
    autoHooks: true,
    cascadeHooks: true,
  });
  
  app.setErrorHandler(errorHandler);

  app.ready(() => {
    if (app.config.NODE_ENV === 'development') {
      console.log(app.printRoutes());
    }
  });

  return app;
}
