import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { RateLimitedResponse } from '../../typebox/responses.js';
import { MinimalUser } from '../../typebox/profiles.js';

const FollowersMutationSchema = {
  tags: ['Followers'],
  security: [{ session: [] }],
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    204: Type.Null(),
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const Follow = {
  summary: 'Follow',
  description: 'The caller followers the user with the given userId; done idempotently',
  ...FollowersMutationSchema,
} satisfies FastifySchema;

export const Unfollow = {
  summary: 'Unfollow',
  description: 'The caller unfollows the user with the given userId; no-op if not following to begin with',
  ...FollowersMutationSchema,
} satisfies FastifySchema;

const FollowersQuerySchema = {
  tags: ['Followers'],
  security: [{ session: [] }],
  response: {
    200: Type.Array(MinimalUser),
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const MyFollowers = {
  summary: 'See your followers',
  description: 'Get your followers\' ids and usernames',
  ...FollowersQuerySchema,
} satisfies FastifySchema;

export const WhoIFollow = {
  summary: 'See who you follow',
  description: 'Get the ids and usernames of the accounts you follow',
  ...FollowersQuerySchema,
} satisfies FastifySchema;

const TheirFollowersQuerySchema = {
  params: Type.Object({
    userId: Type.String(),
  }),
  ...FollowersQuerySchema,
} satisfies FastifySchema;

export const TheirFollowers = {
  summary: 'See someone else\'s followers',
  description: 'Get the ids and usernames of the accounts who follow the account with the given user ID',
  ...TheirFollowersQuerySchema,
} satisfies FastifySchema;

export const WhoTheyFollow = {
  summary: 'See who someone else follows',
  description: 'Get the ids and usernames of the accounts that the account with the given user ID follows',
  ...TheirFollowersQuerySchema,
} satisfies FastifySchema;
