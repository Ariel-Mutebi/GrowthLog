import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyEnv from '@fastify/env';
import autoload from '@fastify/autoload';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import addFormats from 'ajv-formats';
import { EnvSchema } from './typebox/env.js';
import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { sessionPlugin } from './plugins/session.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { rateLimitPlugin } from './plugins/rate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
    },
    trustProxy: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.register(fastifyEnv, {
    schema: EnvSchema,
    dotenv: {
      path: join(__dirname, '../.env'),
    },
    ajv: {
      customOptions: (ajv) => {
        // @ts-expect-error mismatch between index.js but not index.d.ts
        addFormats(ajv);
        return ajv;
      },
    },
  });

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
   * tree under the `/v1` namespace, using directory names as route prefixes.
   */
  app.register(autoload, {
    dir: join(__dirname, './routes'),
    dirNameRoutePrefix: true,
    options: { prefix: 'v1/' },
  });

  app.ready(() => {    
    if (app.config.NODE_ENV === 'development') {
      console.log(app.printRoutes());
    }
  });

  return app;
}
