import type { FastifyPluginAsync, preValidationHookHandler } from 'fastify';

export const userRouter: FastifyPluginAsync = async (app) => {
  app.post('/login', {
    preValidation: app.auth.authenticate('local') as preValidationHookHandler,
  }, (_req, res) => {
    return res.code(204).send();
  });
};
