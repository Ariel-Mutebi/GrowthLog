import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn } from '@/auth/preHandler.js';
import { PersonalService } from '@/services/users/PersonalService.js';
import { DeleteSelf, GetSelf, UpdateSelf } from './schema.js';
import {
  AccountLockedError,
  ForbiddenError,
  UserConflictError,
  WeakPasswordError,
} from '@/services/users/shared/errors.js';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new PersonalService(
    app.prisma,
    app.redis,
    app.config.REDIS_KEY_PREFIX,
  );

  app.get('/', {
    schema: GetSelf,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const me = await service.getSelf(req.user.id);
    return res.code(200).send(me);
  });

  app.patch('/', {
    schema: UpdateSelf,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const newMe = await service.updateSelf(req.user.id, req.body);

      // This device's old session now predates the revocation, so issue it a new one.
      if (req.body.password) {
        await req.session.regenerate();
        await req.logIn(newMe);
      }

      return res.code(200).send(newMe);
    } catch (error) {
      if (error instanceof WeakPasswordError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'Your desired new password is too weak',
        });
      }

      if (error instanceof ForbiddenError) {
        return res.code(403).send({
          error: 'Forbidden',
          message: 'Provide your current password to make this update',
        });
      }

      if (error instanceof UserConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'The username or email you want to change to is already in use',
        });
      }

      if (error instanceof AccountLockedError) {
        return res.code(423).send({
          error: 'Locked',
          message: 'Please wait before you make another attempt at your password',
        });
      }

      throw error;
    }
  });

  app.delete('/', {
    schema: DeleteSelf,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.deleteSelf(req.user.id, req.body.passwordAttempt);
      await req.logOut();
      await req.session.destroy();
      res.clearCookie('sessionId');
      return res.code(204).send(null);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.code(403).send({
          error: 'Forbidden',
          message: 'Please provide your current password to delete your account',
        });
      }

      if (error instanceof AccountLockedError) {
        return res.code(423).send({
          error: 'Locked',
          message: 'Please wait before you make another attempt at your password',
        });
      }

      throw error;
    }
  });
};

export default router;
