import type { FastifyInstance, FastifyRequest, PassportUser, preHandlerHookHandler } from 'fastify';
import type { User } from '../db/client.js';
import type { Static } from '@sinclair/typebox';
import type { LockedResponse, UnauthorizedResponse } from '../typebox/responses.js';

export const isLoggedIn: preHandlerHookHandler = async (req, reply) => {
  if (!req.user) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  }
};

// For Typescript, intended to be called in the handler
export function assertIsLoggedIn(req: FastifyRequest): asserts req is FastifyRequest & { user: PassportUser } {
  if (!req.user) {
    throw new Error('User is not logged in');
  }
}

export const localStrategy = (app: FastifyInstance): preHandlerHookHandler =>
  app.auth.authenticate('local', async (req, res, err, user, info) => {
    if (err) throw err;

    if (!user) {
      const message = (info as { message: string }).message;
      const locked = message.toLowerCase().includes('locked');

      if (locked) {
        return res.code(423).send({
          error: 'Locked',
          message,
        } satisfies Static<typeof LockedResponse>);
      } else {
        return res.code(401).send({
          error: 'Unauthorized',
          message,
        } satisfies Static<typeof UnauthorizedResponse>);
      }
    }

    const {
      id,
      forename,
      surname,
      username,
      email,
      role,
      createdAt,
      deletedAt,
    } = user as User;

    // Restore soft-deleted user if they log back in within 7 days.
    if (deletedAt) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
      if (deletedAt < sevenDaysAgo) {
        return res.code(401).send({
          error: 'Unauthorized',
          message: 'Account permanently deleted',
        } satisfies Static<typeof UnauthorizedResponse>);
      }
  
      await app.prisma.user.update({ where: { id }, data: { deletedAt: null } });
    }

    await req.session.regenerate();
    await req.logIn(user);
    return res.code(200).send({ id, forename, surname, username, email, role, createdAt });
  });
