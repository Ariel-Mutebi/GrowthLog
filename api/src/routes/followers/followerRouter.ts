import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { FollowSomeone, UnfollowSomeone } from './followerSchemas.js';
import { isLoggedIn } from '../../auth/preHandler.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

const followerRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.put('/:userId', {
    schema: FollowSomeone,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    try {
      await app.prisma.followUser.create({
        data: {
          followerId: req.user!.id,
          followingId: req.params.userId,
        },
      });
      return res.code(204).send(null);
    } catch (error) {
      // success if already following
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.code(204).send(null);
      }
      throw error;
    }
  });

  app.delete('/:userId', {
    schema: UnfollowSomeone,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    try {
      await app.prisma.followUser.delete({
        where: {
          followerId_followingId: {
            followerId: req.user!.id,
            followingId: req.params.userId,
          },
        },
      });
      return res.code(204).send(null);
    } catch (error) {
      // success if not following to begin with
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.code(204).send(null);
      }
      throw error;
    }
  });
};

export default followerRouter;
