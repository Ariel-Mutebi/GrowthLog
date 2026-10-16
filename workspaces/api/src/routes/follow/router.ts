import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { Follow, Unfollow, GetFollowers, GetFollowing } from './schema.js';
import { FollowerService, SelfFollowError, FollowTargetNotFoundError } from '../../services/users/FollowerService.js';


const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new FollowerService(app.prisma);

  app.get('ers/:userId', {
    schema: GetFollowers,
  }, async (req, res) => {
    try {
      return res.code(200).send(await service.getFollowers(req.params.userId));
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.get('ing/:userId', {
    schema: GetFollowing,
  }, async (req, res) => {
    try {
      return res.code(200).send(await service.getFollowing(req.params.userId));
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.put('/:userId', {
    schema: Follow,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.follow(req.user.id, req.params.userId);
      return res.code(204).send(null);
    } catch (error) {
      if (error instanceof SelfFollowError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'You cannot follow yourself',
        });
      }

      if (error instanceof FollowTargetNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The user you are trying to follow cannot be found',
        });
      }

      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });

  app.delete('/:userId', {
    schema: Unfollow,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await service.unfollow(req.user.id, req.params.userId);
      return res.code(204).send(null);
    } catch (error) {
      req.log.error(error);
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again.',
      });
    }
  });
};

export default router;
