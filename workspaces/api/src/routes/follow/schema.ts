import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { security } from '../../typebox/constants.js';
import { PublicUserObject } from '../../typebox/users.js';
import { BadRequest, NotFound, Unauthorized, generalErrorResponses } from '../../typebox/responses.js';

const tags = ['Followers'];

export const Follow = {
  summary: 'Follow',
  description: 'Follow the user with the given userId',
  tags,
  security,
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    204: Type.Null(),
    401: Unauthorized,
    400: BadRequest,
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const Unfollow = {
  summary: 'Unfollow',
  description: 'Unfollows the user with the given userId',
  tags,
  security,
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    204: Type.Null(),
    401: Unauthorized,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetFollowers = {
  summary: 'Get followers',
  description: 'Get a list of the followers of a user',
  params: Type.Object({
    userId: Type.String(),
  }),
  tags,
  response: {
    200: Type.Array(PublicUserObject),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetFollowing = {
  summary: 'Get following',
  description: 'Get a list of who a user follows',
  params: Type.Object({
    userId: Type.String(),
  }),
  tags,
  response: {
    200: Type.Array(PublicUserObject),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
