import jwt from 'jsonwebtoken';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { GetCollabToken } from './schema.js';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetCollabToken,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const { forename, surname } = await app.prisma.user.findFirstOrThrow({
      where: {
        id: req.user.id,
      },
      select: {
        forename: true,
        surname: true,
      },
    });

    const token = jwt.sign(
      {
        sub: req.user.id,
        name: `${forename} ${surname}`,
      },
      app.config.JWT_SECRET,
      { expiresIn: '5m' },
    );

    return res.send(token);
  });
};

export default router;
