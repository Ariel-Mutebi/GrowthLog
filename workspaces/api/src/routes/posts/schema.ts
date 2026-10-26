import { Type } from '@sinclair/typebox';
import { Slug } from '@/typebox/inputs.js';
import { SerializableDate } from '@/typebox/date.js';
import { generalErrorResponses, NotFound } from '@/typebox/responses.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '@/typebox/mapping.js';
import type { FeedView, ReadingView } from '@/services/posts/shared/interfaces.js';

const Author = Type.Object({
  id: Type.String(),
  forename: Type.String(),
  surname: Type.String(),
  avatarKey: Type.Union([Type.String(), Type.Null()]),
});

const Feed = Type.Object({
  author: Author,
  slug: Type.String(),
  title: Type.String(),
  hook: Type.String(),
  coverKey: Type.String(),
  tags: Type.Array(Type.String()),
  readingTime: Type.Number(),
} satisfies TypeBoxModel<FeedView>);

export const GetFeed = {
  summary: 'Get feed',
  description: 'Get a personalized feed',
  tags: ['Posts'],
  response: {
    200: Type.Array(Feed),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

const Read = Type.Object({
  id: Type.String(),
  author: Author,
  title: Type.String(),
  likes: Type.Number(),
  comments: Type.Number(),
  hasLiked: Type.Boolean(),
  readingTime: Type.Number(),
  publishedAt: SerializableDate,
  publishedHtml: Type.String(),
} satisfies TypeBoxModel<ReadingView>);

export const ReadPost = {
  summary: 'Read post',
  description: 'Get the content of a post, along with its metadata',
  tags: ['Posts'],
  params: Type.Object({
    slug: Slug,
  }),
  response: {
    200: Read,
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
