import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { security } from '@/typebox/constants.js';
import { CUID, NonEmpty } from '@/typebox/inputs.js';
import { Forbidden, generalErrorResponses, meErrorResponses, NotFound } from '@/typebox/responses.js';
import { CommentObject, CommentQuery } from '../schema.js';

const params = Type.Object({
  postId: CUID,
  commentId: CUID,
});

export const LikeComment = {
  summary: 'Like comment',
  description: 'Idempotently like a comment',
  tags: ['Comment', 'Likes'],
  security,
  params,
  response: {
    204: Type.Null(),
    404: NotFound,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const UnlikeComment = {
  summary: 'Like comment',
  description: 'Remove your like from a comment',
  tags: ['Comment', 'Likes'],
  security,
  params,
  response: {
    204: Type.Null(),
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const GetReplies = {
  summary: 'Get replies',
  description: 'Get replies to a comment',
  tags: ['Comment', 'Replies'],
  security,
  params,
  querystring: CommentQuery,
  response: {
    200: Type.Array(CommentObject),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const ReplyToComment = {
  summary: 'Reply',
  description: 'Reply to a top-level comment',
  tags: ['Comment', 'Replies'],
  security,
  params,
  body: Type.Object({
    text: NonEmpty,
  }),
  response: {
    200: CommentObject,
    404: NotFound,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const EditComment = {
  summary: 'Edit comment',
  description: 'Edit your own comment',
  tags: ['Comment'],
  security,
  params,
  body: Type.Object({
    text: NonEmpty,
  }),
  response: {
    200: CommentObject,
    403: Forbidden,
    404: NotFound,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const DeleteComment = {
  summary: 'Delete comment',
  description: 'Delete your own comment',
  tags: ['Comment'],
  security,
  params,
  response: {
    204: Type.Null(),
    403: Forbidden,
    ...meErrorResponses,
  },
} satisfies FastifySchema;
