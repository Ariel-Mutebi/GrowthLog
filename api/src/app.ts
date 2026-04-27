import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import fastifyHelmet from '@fastify/helmet';
import prisma from './plugins/prisma.js';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { auth } from './auth/authenticator.js';
import { getSecret } from './auth/getSecret.js';
import { buildLocalStrategy } from './auth/localStrategy.js';
import { serializeUser } from './auth/serializeUser.js';
import { buildDeserializeUser } from './auth/deserializeUser.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(fastifyHelmet);
  app.register(prisma);
  app.register(fastifyCookie);
  app.register(fastifySession, {
    secret: getSecret(),
    cookie: {
      secure: false, // set to true in prod, where HTTPS will be used
    },
  });

  app.register(async (app) => {
    app.register(auth.initialize());
    app.register(auth.secureSession());
    auth.use(buildLocalStrategy(app.prisma));
    auth.registerUserSerializer(serializeUser);
    auth.registerUserDeserializer(buildDeserializeUser(app.prisma, app.log.error));
  });

  app.register(sensible);

  return app;
}
