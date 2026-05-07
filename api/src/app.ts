import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { RedisStore } from 'connect-redis';
import autoload from '@fastify/autoload';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyRateLimit from '@fastify/rate-limit';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp() {
  const app = Fastify({
    logger: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  const redis = new Redis(process.env.REDIS_URL!);
  
  redis.on('error', (err) => {
    app.log.error({ err }, 'Redis client error');
  });

  // basic protection against DOS, brute-forcing log-ins
  app.register(fastifyRateLimit, {
    redis,
    max: 60,
    timeWindow: '1 minute',
  });

  // basic security, cookie-based session management
  app.register(fastifyHelmet);
  app.register(fastifyCookie);
  app.register(fastifySession, {
    secret: process.env.SESSION_SECRET!,
    store: new RedisStore({
      client: redis,
      prefix: 'session:',
    }),
    cookie: {
      secure: false, // TODO: find a way to set up HTTPs
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  });

  // custom plugins
  app.register(prismaPlugin);
  app.register(authPlugin);

  /**
   * Load routers from ./routes using autoload, with sub-folder names becoming endpoints.
   * Note: autoload only picks up default exports (e.g export default myRouter).
   */
  app.register(autoload, {
    dir: path.join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
    options: {
      prefix: 'v1/',
    },
    matchFilter: (path) => /Router\.(ts|js)$/.test(path),
  });


  // Log routes to avoid losing your sanity over 404 errors.
  app.ready(() => {
    console.log(app.printRoutes());
  });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await redis.quit();
  });

  return app;
}
