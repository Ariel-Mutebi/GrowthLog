import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { Follow, Unfollow, GetFollowers, GetFollowing } from './schema.js';
import { FollowerService, SelfFollowError, FollowTargetNotFoundError } from '../../services/users/FollowerService.js';


const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new FollowerService(app.prisma);

  app.get('ers/:userId', {
    schema: GetFollowers,
  }, async (req, res) => {
    const followers = await service.getFollowers(req.params.userId);
    return res.code(200).send(followers);
  });

  app.get('ing/:userId', {
    schema: GetFollowing,
  }, async (req, res) => {
    const following = await service.getFollowing(req.params.userId);
    return res.code(200).send(following);
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

      throw error;
    }
  });

  app.delete('/:userId', {
    schema: Unfollow,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    await service.unfollow(req.user.id, req.params.userId);
    return res.code(204).send(null);
  });
};

export default router;
