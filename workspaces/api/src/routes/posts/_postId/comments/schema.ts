import { Type } from '@sinclair/typebox';
import { CUID, NonEmpty } from '@/typebox/inputs.js';
import { security } from '@/typebox/constants.js';
import { SerializableDate } from '@/typebox/date.js';
import { PublicUserObject } from '@/typebox/users.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '@/typebox/mapping.js';
import type { Comment } from '@/services/comments/interfaces.js';
import { generalErrorResponses, meErrorResponses } from '@/typebox/responses.js';

const params = Type.Object({ postId: CUID });

export const CommentObject = Type.Object({
  id: Type.String(),
  text: Type.Union([Type.String(), Type.Null()]),
  commenter: Type.Union([PublicUserObject, Type.Null()]),
  createdAt: SerializableDate,
  updatedAt: SerializableDate,
  likeCount: Type.Number(),
  replyCount: Type.Number(),
} satisfies TypeBoxModel<Comment>);

export const CommentQuery = Type.Partial(Type.Object({
  cursor: CUID,
  take: Type.Integer(),
}));

const tags = ['Comments'];

export const GetComments = {
  summary: 'Get comments',
  description: 'Get a post\'s top-level comments',
  params,
  tags,
  querystring: CommentQuery,
  response: {
    200: Type.Array(CommentObject),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const MakeComment = {
  summary: 'Comment',
  description: 'Comment on a post',
  security,
  params,
  tags,
  body: Type.Object({
    text: NonEmpty,
  }),
  response: {
    200: CommentObject,
    ...meErrorResponses,
  },
} satisfies FastifySchema;
