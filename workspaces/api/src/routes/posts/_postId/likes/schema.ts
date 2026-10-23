import type { FastifySchema } from 'fastify';
import { Type } from '@sinclair/typebox';
import { CUID } from '@/typebox/inputs.js';
import { security } from '@/typebox/constants.js';
import { generalErrorResponses, NotFound } from '@/typebox/responses.js';

const tags = ['Post', 'Likes'];
const params = Type.Object({ postId: CUID });

export const LikePost = {
  summary: 'Like post',
  description: 'Idempotently likes a post',
  security,
  tags,
  params,
  response: {
    204: Type.Null(),
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const UnlikePost = {
  summary: 'Unlike post',
  description: 'Remove your like from a post',
  security,
  tags,
  params,
  response: {
    204: Type.Null(),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
