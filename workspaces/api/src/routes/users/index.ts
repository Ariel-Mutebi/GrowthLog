import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Register, GetUser, UserSearch } from './schema.js';
import { RegistrationService } from '@/services/users/RegistrationService.js';
import { DiscoveryService } from '@/services/users/DiscoveryService.js';
import {
  WeakPasswordError,
  UsernameConflictError,
  EmailConflictError,
  UserNotFoundError,
} from '@/services/users/shared/errors.js';

const REGISTRATION_WINDOW_SECONDS = 24 * 3600;

const router: FastifyPluginAsyncTypebox = async (app) => {
  const registration = new RegistrationService(app.prisma);
  const discovery = new DiscoveryService(app.prisma);

  app.post('/', {
    schema: Register,
  }, async (req, res) => {
    const slot = `${app.config.REDIS_KEY_PREFIX ?? ''}registration:${req.ip}`;
    const reserved = await app.redis.set(slot, '1', { NX: true, EX: REGISTRATION_WINDOW_SECONDS });

    if (!reserved) {
      res.header('retry-after', await app.redis.ttl(slot));
      return res.code(429).send({
        error: 'RateLimited',
        message: 'Only one account can be registered per IP address per day',
      });
    }

    try {
      const user = await registration.register(req.body);
      await req.logIn(user);
      return res.status(201).send(user);
    } catch (error) {
      await app.redis.del(slot);

      if (error instanceof WeakPasswordError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'This password is too weak',
          suggestions: error.suggestions as string[],
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

  app.get('/:id', {
    schema: GetUser,
  }, async (req, res) => {
    try {
      return await discovery.getUser(req.params.id);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The requested user could not be found',
        });
      }

      throw error;
    }
  });

  app.get('/search', {
    schema: UserSearch,
  }, async (req, res) => {
    try {
      const result = await discovery.paginatedSearch(req.query);
      res.code(200).send(result);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'No user matching that criteria was found',
        });
      }

      throw error;
    }
  });
};

export default router;
