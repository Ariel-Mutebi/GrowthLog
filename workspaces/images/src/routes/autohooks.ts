import fp from 'fastify-plugin';
import { verifyJWT } from '../auth/preHandler.js';

export default fp(async (app) => {
  app.addHook('preHandler', verifyJWT);
});
