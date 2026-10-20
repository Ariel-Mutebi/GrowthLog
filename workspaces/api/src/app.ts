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
import type { InternalServerErrorType } from './typebox/responses.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
type Overrides = Partial<Record<keyof Config, string>>;

export function buildApp(overrides?: Overrides) {
  const app = Fastify({
    logger: {
      level: 'info',
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
      'PUBLIC_MINIO_ENDPOINT',
      'PUBLIC_IMAGE_BUCKET',
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
  });

  app.setErrorHandler((error, req, res) => {
    req.log.error(error);
    return res.status(500).send({
      error: 'InternalServerError',
      message: 'Something went wrong. Please try again.',
    } satisfies InternalServerErrorType);
  });

  app.ready(() => {    
    if (app.config.NODE_ENV === 'development') {
      console.log(app.printRoutes());
    }
  });

  return app;
}
