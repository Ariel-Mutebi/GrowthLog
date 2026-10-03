import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { UserPublicSafe } from '../../typebox/userTypes.js';
import { UnauthorizedResponse, generalErrorResponses } from '../../typebox/responses.js';

const FollowersMutationSchema = {
  tags: ['Followers'],
  security: [{ session: [] }],
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    204: Type.Null(),
    401: UnauthorizedResponse,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const Follow = {
  summary: 'Follow',
  description: 'The caller followers the user with the given userId',
  ...FollowersMutationSchema,
} satisfies FastifySchema;

export const Unfollow = {
  summary: 'Unfollow',
  description: 'The caller unfollows the user with the given userId',
  ...FollowersMutationSchema,
} satisfies FastifySchema;

const FollowersQuerySchema = {
  tags: ['Followers'],
  response: {
    200: Type.Array(UserPublicSafe),
    401: UnauthorizedResponse,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const MyFollowers = {
  summary: 'See your followers',
  description: 'Get your followers\' ids and usernames',
  security: [{ session: [] }],
  ...FollowersQuerySchema,
} satisfies FastifySchema;

export const WhoIFollow = {
  summary: 'See who you follow',
  description: 'Get the ids and usernames of the accounts you follow',
  security: [{ session: [] }],
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
