import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { isLoggedIn } from '../../auth/isLoggedIn.js';
import { PostSessionBody } from './sessionSchemas.js';
import type { User } from '../../db/client.js';

export const sessionRouter: FastifyPluginAsync = async (app) => {
  app.post('/', {
    schema: {
      body: PostSessionBody,
    },
    preHandler: app.auth.authenticate('local') as preHandlerHookHandler,
  }, async (req, res) => {
    // prevent session fixation attacks
    await req.session.regenerate();

    // Restore soft-deleted user if they log back in within 7-days.
    if (req.user && (req.user as User).deletedAt) {
      await app.prisma.user.update({
        where: {
          id: req.user.id,
        },
        data: {
          deletedAt: null,
        },
      });
    }

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
