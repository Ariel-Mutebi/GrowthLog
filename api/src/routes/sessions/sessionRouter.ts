import type { FastifyPluginAsync } from 'fastify';
import { isLoggedIn, localStrategy } from '../../auth/preHandler.js';
import { CreateSessionSchema, DeleteSessionSchema } from './sessionSchemas.js';

/*
  * Stricter rate limiting on POST session/ to prevent single machine targeting multiple accounts,
  * and prevent this endpoint being used as a resource exhaustion vector (bcrypt compare is expensive).
*/
const sessionRouter: FastifyPluginAsync = async (app) => {
  app.post('/', {
    schema: CreateSessionSchema,
    preHandler: localStrategy(app),
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000,
        keyGenerator: (req) => `login:${req.ip}`,
      },
    },
  }, async () => {});

  app.delete('/', {
    preHandler: isLoggedIn,
    schema: DeleteSessionSchema,
  }, async (req, res) => {
    await req.session.destroy();
    res.clearCookie('sessionId');
    return res.code(204).send(null);
  });
};

export default sessionRouter;
