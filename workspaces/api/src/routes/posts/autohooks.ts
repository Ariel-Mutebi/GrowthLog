import fp from 'fastify-plugin';
import { PostNotFoundError } from '@/services/posts/shared/errors.js';

export default fp(async (app) => {
  app.setErrorHandler((error, _req, res) => {
    if (error instanceof PostNotFoundError) {
      return res.status(404).send({
        error: 'NotFound',
        message: 'This post could not be found. Maybe the author unpublished or deleted it.',
      });
    }

    throw error;
  });
});
