import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { User } from '../db/client.js';
import type { Static } from '@sinclair/typebox';
import type { LockedResponse, UnauthorizedResponse } from '../types/typebox/responses.js';

export const isLoggedIn: preHandlerHookHandler = async (req, reply) => {
  if (!req.user) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  }
};

// logic here instead of in ../routes/sessions/sessionRouter to access info from local strategy
export const localStrategy = (app: FastifyInstance): preHandlerHookHandler =>
  app.auth.authenticate('local', async (req, reply, err, user, info) => {
    if (err) throw err;

    if (!user) {
      const message = (info as { message: string }).message;
      const locked = message.toLowerCase().includes('locked');

      if (locked) {
        return reply.code(423).send({
          error: 'Locked',
          message,
        } satisfies Static<typeof LockedResponse>);
      } else {
        return reply.code(401).send({
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
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Account permanently deleted',
        } satisfies Static<typeof UnauthorizedResponse>);
      }
  
      await app.prisma.user.update({ where: { id }, data: { deletedAt: null } });
    }

    await req.session.regenerate();
    await req.logIn(user);
    return reply.code(200).send({ forename, surname, username, email, role, createdAt });
  });
