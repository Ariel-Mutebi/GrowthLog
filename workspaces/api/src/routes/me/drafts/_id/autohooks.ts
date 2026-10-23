import fp from 'fastify-plugin';
import { PostNotFoundError } from '@/services/posts/shared/errors.js';

import type { Static } from '@sinclair/typebox';
import type { NotFound } from '@/typebox/responses.js';

export default fp(async (app) => {
  app.setErrorHandler((error, req, res) => {
    if (error instanceof PostNotFoundError) {
      return res.code(404).send({
        error: 'NotFound',
        message: 'This draft could not be found',
      } satisfies Static<typeof NotFound>);
    }

    throw error;
  });
});
