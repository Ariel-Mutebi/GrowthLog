import { type PrismaClient, PrismaClientKnownRequestError } from '@growthlog/db';
import { flattenAvatarKey } from './shared/helpers.js';
import { publicSelect } from './shared/selectors.js';
import type { PublicUser } from './shared/interfaces.js';

export class SelfFollowError extends Error { };
export class FollowTargetNotFoundError extends Error { }

export class FollowerService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async getFollowers(userId: string): Promise<PublicUser[]> {
    const rows = await this.prisma.follow.findMany({
      where: {
        followingId: userId,
        follower: { deletedAt: null },
      },
      select: {
        follower: {
          select: publicSelect,
        },
      },
    });

    return rows.map(row => flattenAvatarKey(row.follower));
  }

  public async getFollowing(userId: string): Promise<PublicUser[]> {
    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        following: { deletedAt: null },
      },
      select: {
        following: {
          select: publicSelect,
        },
      },
    });

    return rows.map(row => flattenAvatarKey(row.following));
  }

  public async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new SelfFollowError();

    const target = await this.prisma.user.findUnique({
      where: { id: followingId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new FollowTargetNotFoundError();

    try {
      await this.prisma.follow.create({
        data: {
          followingId,
          followerId,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }

      throw error;
    }
  }

  public async unfollow(followerId: string, followingId: string) {
    try {
      await this.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }

      throw error;
    }
  }
}
