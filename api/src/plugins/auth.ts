import fp from 'fastify-plugin';
import { Authenticator } from '@fastify/passport';
import { serializeUser } from '../auth/serializeUser.js';
import { deserializeUser } from '../auth/deserializeUser.js';
import { buildLocalStrategy } from '../auth/localStrategy.js';

export const authPlugin = fp(async (app) => {
  const auth = new Authenticator();

  app.register(auth.initialize());
  app.register(auth.secureSession());

  auth.use(buildLocalStrategy(app.prisma));

  auth.registerUserSerializer(serializeUser);
  auth.registerUserDeserializer(deserializeUser);

  app.decorate('auth', auth);
});
