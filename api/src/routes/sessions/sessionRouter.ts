import type { FastifyPluginAsync, preValidationHookHandler } from 'fastify';

export const sessionRouter: FastifyPluginAsync = async (app) => {
  app.post('/', {
    preValidation: app.auth.authenticate('local') as preValidationHookHandler,
  }, async (req, res) => {
    await req.session.regenerate(); // prevent session fixation attacks
    return res.code(204).send();
  });

  app.delete('/', {
    preValidation: app.auth.authenticate('session') as preValidationHookHandler,
  }, async (req, res) => {
    await req.logOut();
    await req.session.destroy();
    await res.clearCookie('sessionId');
    return res.code(204).send();
  });
};
