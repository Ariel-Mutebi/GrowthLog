import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { isLoggedIn } from '../../auth/isLoggedIn.js';
import { PostSessionBody } from './sessionSchemas.js';

export const sessionRouter: FastifyPluginAsync = async (app) => {
  app.post('/', {
    schema: {
      body: PostSessionBody,
    },
    preHandler: app.auth.authenticate('local') as preHandlerHookHandler,
  }, async (req, res) => {
    await req.session.regenerate(); // prevent session fixation attacks
    return res.code(204).send();
  });

  app.delete('/', {
    preValidation: isLoggedIn(app.auth),
  }, async (req, res) => {
    await req.logOut();
    await req.session.destroy();
    await res.clearCookie('sessionId');
    return res.code(204).send();
  });
};
