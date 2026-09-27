import type { PrismaClient } from '@growthlog/db';
import type { UserPublicSafeType } from '../../typebox/userTypes.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export class FollowerService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async getFollowers(userId: string): Promise<UserPublicSafeType[]> {
    const rows = await this.prisma.follow.findMany({
      where: {
        followingId: userId,
      },
      select: {
        follower: {
          omit: {
            email: true,
            password: true,
            deletedAt: true,
          },
        },
      },
    });

    return rows.map(row => row.follower);
  }

  public async getFollowing(userId: string): Promise<UserPublicSafeType[]> {
    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: {
        following: {
          omit: {
            email: true,
            password: true,
            deletedAt: true,
          },
        },
      },
    });

    return rows.map(row => row.following);
  }

  public async follow(followerId: string, followingId: string) {
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
