import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { security } from '@/typebox/constants.js';
import { BadRequest, Forbidden, generalErrorResponses, meErrorResponses } from '@/typebox/responses.js';
import { CommentObject, CommentQuery } from '../schema.js';

const params = Type.Object({
  postId: Type.String(),
  commentId: Type.String(),
});

export const LikeComment = {
  summary: 'Like comment',
  description: 'Idempotently like a comment',
  tags: ['Comment', 'Likes'],
  security,
  params,
  response: {
    204: Type.Null(),
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
    text: Type.String(),
  }),
  response: {
    200: CommentObject,
    400: BadRequest,
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
    text: Type.String(),
  }),
  response: {
    200: CommentObject,
    403: Forbidden,
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
