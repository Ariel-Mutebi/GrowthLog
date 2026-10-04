import type { FastifyInstance, FastifyReply, FastifyRequest, PassportUser, preHandlerHookHandler } from 'fastify';
import type { Static } from '@sinclair/typebox';
import type { LoginFailure } from './authService.js';
import type { UserClientSafe } from '../typebox/userTypes.js';
import type { LockedResponse, UnauthorizedResponse } from '../typebox/responses.js';

export const isLoggedIn: preHandlerHookHandler = async (req, reply) => {
  if (!req.user) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  }
};

/* Call as type assertion within request handler that uses isLoggedIn as a pre-handler. */
export function assertIsLoggedIn(req: FastifyRequest): asserts req is FastifyRequest & { user: PassportUser } {
  if (!req.user) {
    throw new Error('User is not logged in');
  }
}

export const localStrategy = (app: FastifyInstance): preHandlerHookHandler =>
  app.auth.authenticate('local', async (
    req: FastifyRequest,
    res: FastifyReply,
    err: unknown,
    user: UserClientSafe,
    info: object,
  ) => {
    if (err) throw err;

    if (!user) {
      const failure = (info as { message: LoginFailure }).message;
      switch (failure) {
        case 'locked':
          return res.code(423).send({
            error: 'Locked',
            message: 'Account temporarily locked',
          } satisfies Static<typeof LockedResponse>);
        case 'expired':
          return res.code(401).send({
            error: 'Unauthorized',
            message: 'Account permanently deleted',
          } satisfies Static<typeof UnauthorizedResponse>);
        case 'invalid':
          return res.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid email or password',
          } satisfies Static<typeof UnauthorizedResponse>);
        default: {
          const unreachable: never = failure;
          throw new Error(`Unhandled login failure: ${String(unreachable)}`);
        }
      }
    }

    await req.session.regenerate();
    await req.logIn(user);
    return res.code(200).send(user);
  });
