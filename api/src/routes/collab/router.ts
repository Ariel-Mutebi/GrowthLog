import jwt from 'jsonwebtoken';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { GetCollabToken } from './schema.js';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import type { Env } from '../../typebox/env.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetCollabToken,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const token = jwt.sign(
      req.user.id,
      (process.env as object as Env).JWT_SECRET,
      { expiresIn: '5m' },
    );

    return res.send(token);
  });
};

export default router;
