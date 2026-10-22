import type { FastifySchema } from 'fastify';
import { Type } from '@sinclair/typebox';
import { CUID } from '@/typebox/inputs.js';
import { security } from '@/typebox/constants.js';
import { generalErrorResponses } from '@/typebox/responses.js';

const tags = ['Post', 'Likes'];

const schema = {
  security,
  tags,
  params: Type.Object({
    postId: CUID,
  }),
  response: {
    204: Type.Null(),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const LikePost = {
  summary: 'Like post',
  description: 'Idempotently likes a post',
  ...schema,
} satisfies FastifySchema;

export const UnlikePost = {
  summary: 'Unlike post',
  description: 'Remove your like from a post',
  ...schema,
} satisfies FastifySchema;
