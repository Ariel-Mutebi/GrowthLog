import type { FastifyPluginAsync } from 'fastify';
import { isLoggedIn, localStrategy } from '../../auth/prevalidation.js';
import { CreateSessionSchema, DeleteSessionSchema } from './sessionSchemas.js';
import type { User } from '../../db/client.js';

/*
  * Stricter rate limiting on POST session/ to prevent single machine targeting multiple accounts,
  * and prevent this endpoint being used as a resource exhaustion vector (bcrypt compare is expensive).
*/
const sessionRouter: FastifyPluginAsync = async (app) => {
  app.post('/', {
    schema: CreateSessionSchema,
    preHandler: localStrategy(app.auth),
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: (req) => `login:${req.ip}`,
      },
    },
  }, async (req, res) => {
    // user is fully hydrated by local strategy
    const user = req.user as User;

    // Restore soft-deleted user if they log back in within 7-days.
    if (user.deletedAt) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      if (user.deletedAt < sevenDaysAgo) {
        return res.code(401).send({
          error: 'Unauthorized',
          message: 'Account permanently deleted',
        });
      }

      await app.prisma.user.update({
        where: {
          id: req.user!.id,
        },
        data: {
          deletedAt: null,
        },
      });
    }
    
    await req.session.regenerate(); // prevent session fixation attacks
    await req.logIn(user);
    const { forename, surname, username, email, role, createdAt } = user;

    return res.code(200).send({
      forename,
      surname,
      username,
      email,
      role,
      createdAt,
    });
  });

  app.delete('/', {
    preValidation: isLoggedIn(app.auth),
    schema: DeleteSessionSchema,
  }, async (req, res) => {
    await req.logOut();
    await req.session.destroy();
    await res.clearCookie('sessionId');
    return res.code(204).send();
  });
};

export default sessionRouter;
