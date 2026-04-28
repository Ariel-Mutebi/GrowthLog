import type { FastifyPluginAsync } from 'fastify';

export const userRouter: FastifyPluginAsync = async (app) => {
  app.post('/', () => {}); // TODO: create user handler here
};
