import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { RateLimitedResponse } from '../../typebox/responses.js';

const BaseFollowSchema = {
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

export const FollowSomeone = {
  summary: 'Follow',
  description: 'The caller followers the user with the given userId; done idempotently',
  ...BaseFollowSchema,
} satisfies FastifySchema;

export const UnfollowSomeone = {
  summary: 'Unfollow',
  description: 'The caller unfollows the user with the given userId; no-op if not following to begin with',
  ...BaseFollowSchema,
} satisfies FastifySchema;
