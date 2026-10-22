import fp from 'fastify-plugin';
import { trimStrings } from '@/utils/sanitize.js';

export default fp(async (app) => {
  app.addHook('preValidation', async (req) => {
    if (typeof req.body === 'object') {
      req.body = trimStrings(req.body);
    }
  });
});
