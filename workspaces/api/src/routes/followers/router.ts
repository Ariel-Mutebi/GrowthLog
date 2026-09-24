import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Follow, MyFollowers, TheirFollowers, Unfollow, WhoIFollow, WhoTheyFollow } from './schema.js';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

async function getFollowers(app: FastifyInstance, userId: string) {
  const rows = await app.prisma.follow.findMany({
    where: { followingId: userId },
    select: { follower: { select: { id: true, username: true } } },
  });
  return rows.map(r => r.follower);
}

async function getFollowing(app: FastifyInstance, userId: string) {
  const rows = await app.prisma.follow.findMany({
    where: { followerId: userId },
    select: { following: { select: { id: true, username: true } } },
  });
  return rows.map(r => r.following);
}

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/myFollowers', {
    preHandler: isLoggedIn,
    schema: MyFollowers,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const followers = await getFollowers(app, req.user.id);
    res.code(200).send(followers);
  });

  app.get('/:userId/followers', {
    schema: TheirFollowers,
  }, async (req, res) => {
    const followers = await getFollowers(app, req.params.userId);
    res.code(200).send(followers);
  });

  app.get('/whoIFollow', {
    preHandler: isLoggedIn,
    schema: WhoIFollow,
  }, async (req, res) => {
    assertIsLoggedIn(req);
    const following = await getFollowing(app, req.user.id);
    res.code(200).send(following);
  });

  app.get('/:userId/following', {
    schema: WhoTheyFollow,
  }, async (req, res) => {
    const following = await getFollowing(app, req.params.userId);
    res.code(200).send(following);
  });

  app.put('/:userId', {
    schema: Follow,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await app.prisma.follow.create({
        data: {
          followerId: req.user.id,
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
    schema: Unfollow,
    preHandler: isLoggedIn,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    try {
      await app.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
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

export default router;
