import fp from 'fastify-plugin';
import { isLoggedIn } from '../../auth/preHandler.js';

export default fp(async (app) => {
  app.addHook('preHandler', isLoggedIn);
});
