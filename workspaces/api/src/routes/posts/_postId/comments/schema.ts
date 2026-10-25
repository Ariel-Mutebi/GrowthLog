import { Type } from '@sinclair/typebox';
import { CUID, NonEmpty } from '@/typebox/inputs.js';
import { security } from '@/typebox/constants.js';
import { SerializableDate } from '@/typebox/date.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '@/typebox/mapping.js';
import type { Comment } from '@/services/posts/shared/interfaces.js';
import { generalErrorResponses, meErrorResponses, NotFound } from '@/typebox/responses.js';

const params = Type.Object({ postId: CUID });

export const Author = Type.Object({
  id: Type.String(),
  forename: Type.String(),
  surname: Type.String(),
  avatarKey: Type.Union([Type.String(), Type.Null()]),
});

export const CommentObject = Type.Object({
  id: Type.String(),
  text: Type.Union([Type.String(), Type.Null()]),
  commenter: Type.Union([Author, Type.Null()]),
  createdAt: SerializableDate,
  updatedAt: SerializableDate,
  likeCount: Type.Number(),
  replyCount: Type.Number(),
} satisfies TypeBoxModel<Comment>);

export const CommentQuery = Type.Partial(Type.Object({
  cursor: CUID,
  take: Type.Integer({ minimum: 1, maximum: 100 }),
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
    404: NotFound,
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
    201: CommentObject,
    ...meErrorResponses,
  },
} satisfies FastifySchema;
