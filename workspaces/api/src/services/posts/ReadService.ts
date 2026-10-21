import { PostNotFoundError } from './shared/errors.js';
import { avatarSelect } from '../users/shared/selectors.js';
import { flattenAvatarKey } from '../users/shared/helpers.js';

import type { PrismaClient, UserSelect } from '@growthlog/db';
import type { ReadingView, FeedView } from './shared/interfaces.js';

type InterestMap = Map<string, number>;

const DAY = 86_400_000;
const INTEREST_WINDOW_DAYS = 60;
const ONBOARDING_HALF_LIFE_DAYS = 30;
const FRESHNESS_HALF_LIFE_DAYS = 14;

const authorSelect = {
  id: true,
  username: true,
  ...avatarSelect,
} satisfies UserSelect;

export class ReadService {
  constructor(private readonly prisma: PrismaClient) {}

  public async read(slug: string, userId?: string): Promise<ReadingView> {
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        deletedAt: null,
        publishedAt: { not: null },
      },
      select: {
        id: true,
        author: { select: authorSelect },
        readingTime: true,
        publishedAt: true,
        publishedTitle: true,
        publishedHtml: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!post) throw new PostNotFoundError();

    if (userId) {
      await this.prisma.view.create({
        data: {
          userId,
          postId: post.id,
          type: 'OPENED',
        },
      });
    }

    return {
      id: post.id,
      author: flattenAvatarKey(post.author),
      title: post.publishedTitle!,
      publishedHtml: post.publishedHtml!,
      publishedAt: post.publishedAt!,
      readingTime: post.readingTime!,
      likes: post._count.likes,
      comments: post._count.comments,
    };
  }

  public async finished(postId: string, userId: string) {
    await this.prisma.view.create({
      data: {
        postId,
        userId,
        type: 'READ',
      },
    });
  }

  /**
   * Every recommendation engine uses a three-step pipeline:
   * 1. Find candidates.
   * 2. Score them.
   * 3. Sort them.
  */
  public async getFeed(userId: string): Promise<FeedView[]> {
    const interests = await this.getInterests(userId);

    const candidates = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        publishedAt: { not: null },
        author: { deletedAt: null },
        authorId: { not: userId },
        views: { none: { userId } },
        OR: [
          { tags: { some: { id: { in: [...interests.keys()] } } } },
          { author: { followers: { some: { followerId: userId } } } },
        ],
      },
      take: 300,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        tags: true,
        publishedAt: true,
        publishedTitle: true,
        readingTime: true,
        author: {
          select: {
            ...authorSelect,
            followers: { where: { followerId: userId }, select: { followerId: true } },
          },
        },
      },
    });

    const scored = candidates.map((post) => {
      // tagMatch = ∑ interest / √ (tag count) so that posts that focus on the user's interests
      // are ranked above those which simply have many tags (and a higher chance of matching).
      const tagMatch =
        post.tags.reduce((sum, t) => sum + (interests.get(t.id) ?? 0), 0) /
        Math.sqrt(post.tags.length || 1);

      const followBonus = post.author.followers.length ? 5 : 0;
      const ageDays = (Date.now() - post.publishedAt!.getTime()) / DAY;
      const freshness = Math.pow(0.5, ageDays / FRESHNESS_HALF_LIFE_DAYS);
      return { ...post, score: (tagMatch + followBonus) * freshness };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 100).map((post) => ({
      id: post.id,
      title: post.publishedTitle!,
      readingTime: post.readingTime!,
      tags: post.tags.map(tag => tag.name),
      author: flattenAvatarKey({
        id: post.author.id,
        username: post.author.username,
        avatar: post.author.avatar,
      }),
    }));
  }

  private async getInterests(userId: string): Promise<InterestMap> {
    const onboarding = await this.prisma.onboardingInterest.findMany({ where: { userId } });

    const since = new Date(Date.now() - INTEREST_WINDOW_DAYS * DAY);
    const engaged = await this.prisma.post.findMany({
      where: {
        OR: [
          { likes: { some: { createdAt: { gt: since } } } },
          { views: { some: { userId, type: 'READ', createdAt: { gt: since } } } },
        ],
      },
      take: 200,
      select: { tags: { select: { id: true } } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    });

    const interests: InterestMap = new Map();
    
    function add(tagId: string, weight: number) {
      interests.set(tagId, (interests.get(tagId) ?? 0) + weight);
    }

    onboarding.forEach((interest) => {
      // time decay on onboarding interests so feed doesn't feel locked to initial interests
      const ageDays = (Date.now() - interest.createdAt.getTime()) / DAY;
      add(interest.tagId, 3 * Math.pow(0.5, ageDays / ONBOARDING_HALF_LIFE_DAYS));
    });

    engaged.forEach(post => post.tags.forEach(tag => add(tag.id, 1)));

    return interests;
  }
}
