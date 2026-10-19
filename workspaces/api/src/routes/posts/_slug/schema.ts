import { Type } from '@sinclair/typebox';
import { PublicUserObject } from '@/typebox/users.js';
import { generalErrorResponses, NotFound } from '@/typebox/responses.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '@/typebox/mapping.js';
import type { ReadingView } from '@/services/posts/ReadService.js';

const Read = Type.Object({
  author: PublicUserObject,
  title: Type.String(),
  likes: Type.Number(),
  comments: Type.Number(),
  publishedHtml: Type.String(),
} satisfies TypeBoxModel<ReadingView>);

export const ReadPost = {
  summary: 'Read post',
  description: 'Get the content of a post, along with its metadata',
  tags: ['Post', 'Public'],
  params: Type.Object({
    slug: Type.String(),
  }),
  response: {
    200: Read,
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
