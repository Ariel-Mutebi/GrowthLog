import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import {
  CreateUserSchema,
  UpdateSelfSchema,
  DeleteSelfSchema,
  GetUserSchema,
  GetSelfSchema,
  UserSearchSchema,
} from './schema.js';
import {
  UserService,
  UserConflictError,
  EmailConflictError,
  UserNotFoundError,
  PasswordTooWeakError,
  UsernameConflictError,
  UserMutationUnauthorizedError,
} from './service.js';

const REGISTRATION_WINDOW_SECONDS = 24 * 3600;

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new UserService(app.prisma);

  app.post('/', { schema: CreateUserSchema }, async (req, res) => {
    const slot = `${app.config.REDIS_KEY_PREFIX ?? ''}registration:${req.ip}`;
    const reserved = await app.redis.set(slot, '1', { NX: true, EX: REGISTRATION_WINDOW_SECONDS });

    if (!reserved) {
      res.header('retry-after', await app.redis.ttl(slot));
      return res.code(429).send({
        error: 'RateLimited',
        message: 'Only one account can be registered per IP address per day',
      });
    }

    let created = false;
    try {
      const user = await service.create(req.body);
      created = true;
      await req.logIn(user);
      return res.status(201).send(user);
    } catch (error) {
      if (!created) await app.redis.del(slot);

      if (error instanceof PasswordTooWeakError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'This password is too weak',
          suggestions: error.suggestions as string[],
        });
      }

      if (error instanceof UserConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'This username or email is already in use',
        });
      }

      if (error instanceof UsernameConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'This username is already in use',
        });
      }

      if (error instanceof EmailConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'This email is already in use',
        });
      }

      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetSelfSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const user = await service.getSelf(req.user.id);
      return res.code(200).send(user);
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.get('/:userId', {
    schema: GetUserSchema,
  }, async (req, res) => {
    try {
      return await service.getOther(req.params.userId);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The requested user could not be found',
        });
      }

      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });      
    }
  });

  app.get('/search', {
    schema: UserSearchSchema,
  }, async (req, res) => {
    try {
      const result = await service.paginatedSearch(req.query);
      res.code(200).send(result);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'No user matching that criteria was found',
        });
      }

      req.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      }); 
    }
  });

  app.patch('/', {
    preHandler: isLoggedIn,
    schema: UpdateSelfSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const updatedUser = await service.update(req.user.id, req.body);
      return res.code(200).send(updatedUser);
    } catch (error) {
      if (error instanceof UserMutationUnauthorizedError) {
        return res.code(401).send({
          error: 'Unauthorized',
          message: 'Please provide your current password to update this field',
        });
      }

      if (error instanceof PasswordTooWeakError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'Your desired new password is too weak',
          suggestions: error.suggestions as string[],
        });
      }

      if (error instanceof UserConflictError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'Your desired username or email is already in use',
        });
      }

      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.delete('/', {
    preHandler: isLoggedIn,
    schema: DeleteSelfSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      const softDeletedUser = await service.softDelete(req.user.id, req.body.currentPassword);
      await req.logOut();
      await req.session.destroy();
      res.clearCookie('sessionId');
      return res.send(softDeletedUser);
    } catch (error) {
      if (error instanceof UserMutationUnauthorizedError) {
        return res.code(401).send({
          error: 'Unauthorized',
          message: 'Please provide your account password to delete your account',
        });
      }

      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again',
      });
    }
  });
};

export default router;
