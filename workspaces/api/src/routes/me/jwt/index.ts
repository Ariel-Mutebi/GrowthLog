import jwt from 'jsonwebtoken';
import { Handoff } from './schema.js';
import { assertIsLoggedIn } from '@/auth/preHandler.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/', {
    schema: Handoff,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const token = jwt.sign(
      {
        sub: req.user.id,
        name: req.user.username,
      },
      app.config.JWT_SECRET,
      { expiresIn: '1min' },
    );

    return res.send({ token });
  });
};

export default router;
