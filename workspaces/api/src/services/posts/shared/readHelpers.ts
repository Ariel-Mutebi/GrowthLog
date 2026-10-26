import { authorSelect } from './selectors.js';
import { flattenAvatarKey } from '../../users/shared/helpers.js';

import type {
  PostSelect,
  PostGetPayload,
  PostWhereInput,
} from '@growthlog/db';
import type { FeedView } from './interfaces.js';

export const DAY = 86_400_000;
const FRESHNESS_HALF_LIFE_DAYS = 14;

const FOLLOW_BONUS = 5;
const EXPLORATION_BASE = 0.3;
const POPULARITY_WEIGHT = 0.5;

const AUTHOR_DECAY = 0.5;
const TAG_DECAY = 0.7;

export type InterestMap = Map<string, number>;
export type TagWeight = { tagId: string; weight: number };

/** Rules every candidate must satisfy, regardless of which pool it came from. */
export function baseWhere(userId?: string) {
  return {
    deletedAt: null,
    publishedAt: { not: null },
    coverImageId: { not: null },
    author: { deletedAt: null },
    ...(userId && { views: { none: { userId } } }),
  } satisfies PostWhereInput;
}

/** Select shape shared by every candidate pool, so pools can be merged and scored uniformly. */
export function candidateSelect(userId?: string) {
  return {
    id: true,
    slug: true,
    authorId: true,
    tags: true,
    publishedAt: true,
    publishedTitle: true,
    publishedHook: true,
    readingTime: true,
    _count: { select: { likes: true, views: true } },
    cover: { select: { image: { select: { key: true } } } },
    author: {
      select: {
        ...authorSelect,
        followers: userId
          ? { where: { followerId: userId }, select: { followerId: true } }
          : { take: 0, select: { followerId: true } },
      },
    },
  } satisfies PostSelect;
}

export type FeedCandidate = PostGetPayload<{ select: ReturnType<typeof candidateSelect> }>;
export type ScoredCandidate = FeedCandidate & { score: number };

/** Exponential decay: returns 1 at age 0, 0.5 at one half-life, 0.25 at two, and so on. */
export function halfLifeDecay(ageMs: number, halfLifeDays: number): number {
  return Math.pow(0.5, ageMs / DAY / halfLifeDays);
}

/** Collapses a list of (tag, weight) signals into a single tag -> total weight map. */
export function sumWeights(signals: TagWeight[]): InterestMap {
  const interests: InterestMap = new Map();
  for (const { tagId, weight } of signals) {
    interests.set(tagId, (interests.get(tagId) ?? 0) + weight);
  }
  return interests;
}

/**
 * Score = (exploration floor + interest match + follow bonus + popularity) * freshness.
 */
export function scoreCandidate(post: FeedCandidate, interests: InterestMap, now: number): number {
  // Dividing by √(tag count) stops posts from ranking high merely because they carry many
  // tags (and so have more chances to match). Posts focused on your interests win.
  const tagMatch =
    post.tags.reduce((sum, t) => sum + (interests.get(t.id) ?? 0), 0) /
    Math.sqrt(post.tags.length || 1);

  const followBonus = post.author.followers.length ? FOLLOW_BONUS : 0;

  // Log scale so one viral post doesn't drown everything else. Likes are weighted above
  // views because they're a much rarer, more deliberate action.
  const popularity = Math.log1p(post._count.likes * 3 + post._count.views) * POPULARITY_WEIGHT;
  const freshness = halfLifeDecay(now - post.publishedAt!.getTime(), FRESHNESS_HALF_LIFE_DAYS);

  return (EXPLORATION_BASE + tagMatch + followBonus + popularity) * freshness;
}

/**
 * Greedy re-rank. Repeatedly picks the best remaining post after discounting posts whose
 * tags have already appeared, so the feed doesn't become ten posts on one topic in a row.
 */
export function diversify(sorted: ScoredCandidate[], limit: number): ScoredCandidate[] {
  const remaining = [...sorted];
  const result: ScoredCandidate[] = [];
  const tagCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();

  while (result.length < limit && remaining.length) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const post = remaining[i]!;

      let penalty = 1;
      penalty *= Math.pow(AUTHOR_DECAY, authorCounts.get(post.authorId) ?? 0);

      for (const tag of post.tags) {
        penalty *= Math.pow(TAG_DECAY, tagCounts.get(tag.id) ?? 0);
      }

      const adjusted = post.score * penalty;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIdx = i;
      }
    }

    const pick = remaining.splice(bestIdx, 1)[0]!;
    result.push(pick);

    authorCounts.set(pick.authorId, (authorCounts.get(pick.authorId) ?? 0) + 1);
    for (const tag of pick.tags) tagCounts.set(tag.id, (tagCounts.get(tag.id) ?? 0) + 1);
  }

  return result;
}

export function toFeedView(post: FeedCandidate): FeedView {
  return {
    id: post.id,
    slug: post.slug,
    title: post.publishedTitle!,
    hook: post.publishedHook!,
    readingTime: post.readingTime!,
    coverKey: post.cover!.image.key,
    tags: post.tags.map((tag) => tag.name),
    author: flattenAvatarKey({
      id: post.author.id,
      forename: post.author.forename,
      surname: post.author.surname,
      avatar: post.author.avatar,
    }),
  };
}
