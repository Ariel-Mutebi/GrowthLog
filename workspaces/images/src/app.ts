import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import fastifyHelmet from '@fastify/helmet';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { loadEnv } from '@growthlog/env';
import { prismaPlugin } from './plugins/prisma.js';
import { minioPlugin } from './plugins/minio.js';
import { authPlugin } from './plugins/auth.js';
import { swaggerPlugin } from './plugins/swagger.js';

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

  const config = loadEnv([
    'NODE_ENV',
    'PUBLIC_IMAGES_PORT',
    'JWT_SECRET',
    'DATABASE_URL',
    'MINIO_ENDPOINT',
    'MINIO_ROOT_USER',
    'MINIO_ROOT_PASSWORD',
    'PUBLIC_AVATAR_BUCKET',
    'PUBLIC_MINIO_ENDPOINT',
    'PUBLIC_MAX_AVATAR_SIZE_BYTES',
    'PRESIGNED_URL_EXPIRY_SECONDS',
  ]);

  app.decorate('config', config);
  app.register(fastifyHelmet);
  app.register(prismaPlugin);
  app.register(minioPlugin);
  app.register(authPlugin);
  app.register(swaggerPlugin);

  app.register(autoload, {
    dir: join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    options: { prefix: 'images/' },
  });

  app.ready(() => {
    if (app.config.NODE_ENV === 'development') {
      console.log(app.printRoutes());
    }
  });

  return app;
}
