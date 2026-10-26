import { PostNotFoundError } from './shared/errors.js';
import { authorSelect } from './shared/selectors.js';
import { flattenAvatarKey } from '../users/shared/helpers.js';
import {
  DAY,
  scoreCandidate,
  diversify,
  toFeedView,
  halfLifeDecay,
  sumWeights,
  baseWhere,
  candidateSelect,
  type TagWeight,
  type FeedCandidate,
  type InterestMap,
  type ScoredCandidate,
} from './shared/readHelpers.js';

import type { PrismaClient, PostWhereInput } from '@growthlog/db';
import type { ReadingView, FeedView } from './shared/interfaces.js';

const FEED_SIZE = 100;
const CANDIDATES_PER_POOL = 150;
const POPULAR_POOL_WINDOW_DAYS = 14;

// Interest signals.
const ONBOARDING_WEIGHT = 3;
const READ_WEIGHT = 2;
const LIKE_WEIGHT = 1;
const ONBOARDING_HALF_LIFE_DAYS = 30;
const ENGAGEMENT_HALF_LIFE_DAYS = 14;
const ENGAGEMENT_SAMPLE_SIZE = 200;

export class ReadService {
  constructor(private readonly prisma: PrismaClient) {}

  public async read(slug: string, userId?: string): Promise<ReadingView> {
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        deletedAt: null,
        publishedAt: { not: null },
        author: { deletedAt: null },
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
        ...(userId && {
          likes: {
            where: { userId },
            select: { userId: true },
            take: 1,
          },
        }),
      },
    });

    if (!post) throw new PostNotFoundError();

    return {
      id: post.id,
      author: flattenAvatarKey(post.author),
      title: post.publishedTitle!,
      publishedHtml: post.publishedHtml!,
      publishedAt: post.publishedAt!,
      readingTime: post.readingTime!,
      likes: post._count.likes,
      comments: post._count.comments,
      hasLiked: Boolean(post.likes?.length),
    };
  }

  /**
   * Every recommendation engine uses a three-step pipeline:
   * 1. Find candidates.
   * 2. Score them.
   * 3. Sort them (here: sort, then re-rank for diversity).
   */
  public async getFeed(userId?: string): Promise<FeedView[]> {
    const now = Date.now();
    const interests = userId
      ? await this.getInterests(userId, now)
      : new Map();

    const candidates = await this.findCandidates(userId, [...interests.keys()]);

    const scored: ScoredCandidate[] = candidates.map((post) => ({
      ...post,
      score: scoreCandidate(post, interests, now),
    }));
    scored.sort((a, b) => b.score - a.score);

    return diversify(scored, FEED_SIZE).map(toFeedView);
  }

  private async getInterests(userId: string, now: number): Promise<InterestMap> {
    const [onboarding, likes, reads] = await Promise.all([
      this.getOnboardingSignals(userId, now),
      this.getLikeSignals(userId, now),
      this.getReadSignals(userId, now),
    ]);
    return sumWeights([...onboarding, ...likes, ...reads]);
  }

  /** Onboarding picks, decayed so the feed doesn't stay locked to day-one choices. */
  private async getOnboardingSignals(userId: string, now: number): Promise<TagWeight[]> {
    const onboarding = await this.prisma.onboardingInterest.findMany({ where: { userId } });

    return onboarding.map((interest) => ({
      tagId: interest.tagId,
      weight:
        ONBOARDING_WEIGHT * halfLifeDecay(now - interest.createdAt.getTime(), ONBOARDING_HALF_LIFE_DAYS),
    }));
  }

  /** Tags of recently liked posts, decayed by when the user liked */
  private async getLikeSignals(userId: string, now: number): Promise<TagWeight[]> {
    const likes = await this.prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // most recent first, so `take` drops the oldest
      take: ENGAGEMENT_SAMPLE_SIZE,
      select: { createdAt: true, post: { select: { tags: { select: { id: true } } } } },
    });

    return likes.flatMap((like) =>
      like.post.tags.map((tag) => ({
        tagId: tag.id,
        weight: LIKE_WEIGHT * halfLifeDecay(now - like.createdAt.getTime(), ENGAGEMENT_HALF_LIFE_DAYS),
      })),
    );
  }

  /** Tags of recently read posts, decayed by when the user read them. */
  private async getReadSignals(userId: string, now: number): Promise<TagWeight[]> {
    const reads = await this.prisma.view.findMany({
      where: { userId, type: 'READ' },
      orderBy: { createdAt: 'desc' },
      take: ENGAGEMENT_SAMPLE_SIZE,
      select: {
        createdAt: true,
        post: { select: { tags: { select: { id: true } } } },
      },
    });

    // Every READ row counts, so re-reading a post reinforces its tags. Each row is decayed
    // by its own age, so a re-read last week outweighs the original read last month.
    return reads.flatMap((read) =>
      read.post.tags.map((tag) => ({
        tagId: tag.id,
        weight: READ_WEIGHT * halfLifeDecay(now - read.createdAt.getTime(), ENGAGEMENT_HALF_LIFE_DAYS),
      })),
    );
  }

  private async findCandidates(userId: string | undefined, interestIds: string[]): Promise < FeedCandidate[] > {
    const [personalized, recent, popular] = await Promise.all([
      userId ? this.findPersonalizedPool(userId, interestIds) : [],
      this.findRecentPool(userId),
      this.findPopularPool(userId),
    ]);

    // The same post often appears in several pools, so dedupe by id.
    const byId = new Map<string, FeedCandidate>();
    for(const post of [...personalized, ...recent, ...popular]) byId.set(post.id, post);
    return [...byId.values()];
  }

  /** Posts matching the user's interests or by authors they follow. */
  private findPersonalizedPool(userId: string, interestIds: string[]): Promise<FeedCandidate[]> {
    const matchers: PostWhereInput[] = [
      { author: { followers: { some: { followerId: userId } } } },
    ];

    if (interestIds.length) {
      matchers.push({ tags: { some: { id: { in: interestIds } } } });
    }

    return this.prisma.post.findMany({
      where: {
        ...baseWhere(userId),
        OR: matchers,
      },
      select: candidateSelect(userId),
      take: CANDIDATES_PER_POOL,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    });
  }

  /** Newest posts with no personalization. This pool is the graceful-degradation floor. */
  private findRecentPool(userId?: string): Promise < FeedCandidate[] > {
    return this.prisma.post.findMany({
      where: baseWhere(userId),
      take: CANDIDATES_PER_POOL,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: candidateSelect(userId),
    });
  }

  /** Most-liked recent posts: discovery outside the user's bubble. */
  private findPopularPool(userId?: string): Promise<FeedCandidate[]> {
    const since = new Date(Date.now() - POPULAR_POOL_WINDOW_DAYS * DAY);

    return this.prisma.post.findMany({
      where: {
        ...baseWhere(userId),
        publishedAt: { gte: since },
      },
      take: CANDIDATES_PER_POOL,
      select: candidateSelect(userId),
      orderBy: [{ likes: { _count: 'desc' } }, { publishedAt: 'desc' }, { id: 'desc' }],
    });
  }
}
