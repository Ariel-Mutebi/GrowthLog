import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import fastifyJwt from '@fastify/jwt';
import fastifyHelmet from '@fastify/helmet';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { loadEnv } from '@growthlog/env';
import { prismaPlugin } from './plugins/prisma.js';
import { minioPlugin } from './plugins/minio.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { errorHandler } from './utils/errorHandler.js';
import type { Config } from './types/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function buildApp(overrides?: Partial<Config>) {
  const config = loadEnv([
    'NODE_ENV',
    'IMAGES_PORT',
    'JWT_SECRET',
    'DATABASE_URL',
    'MINIO_ENDPOINT',
    'MINIO_ROOT_USER',
    'MINIO_ROOT_PASSWORD',
    'PUBLIC_AVATAR_BUCKET',
    'PUBLIC_IMAGE_BUCKET',
    'PUBLIC_MINIO_ENDPOINT',
    'PUBLIC_MAX_AVATAR_SIZE_BYTES',
    'PUBLIC_MAX_IMAGE_SIZE_BYTES',
    'PRESIGNED_URL_EXPIRY_SECONDS',
  ], overrides);

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'warn' : 'info',
    },
    trustProxy: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.decorate('config', config);
  app.register(fastifyHelmet);
  app.register(prismaPlugin);
  app.register(minioPlugin);
  app.register(swaggerPlugin);

  app.register(fastifyJwt, {
    secret: app.config.JWT_SECRET,
  });

  app.register(autoload, {
    dir: join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    options: { prefix: 'images/' },
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
