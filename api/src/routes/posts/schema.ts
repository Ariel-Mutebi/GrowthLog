import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { ConflictResponse, NotFoundResponse, RateLimitedResponse } from '../../typebox/responses.js';
import { SerializedDate } from '../../typebox/compatability.js';

const Post = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  id: Type.String(),
  authorId: Type.String(),
  content: Type.Unknown(),
  draftContent: Type.Union([Type.Unknown(), Type.Null()]),
  published: Type.Boolean(),
  createdAt: SerializedDate,
  updatedAt: SerializedDate,
  deletedAt: Type.Union([SerializedDate, Type.Null()]),
});

export const CreatePostSchema = {
  summary: 'Create a new blog post',
  description: 'Create an empty blog post with a title and slug (slug is derived from title if absent)',
  tags: ['Posts'],
  body: Type.Object({
    title: Type.String(),
    slug: Type.String(),
  }),
  response: {
    201: Post,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const UpdatePostMetadata = {
  summary: 'Update a post\'s metadata',
  description: 'Update the title and slug of a post',
  tags: ['Posts'],
  params: Type.Object({
    postId: Type.String(),
  }),
  body: Type.Partial(Type.Object({
    title: Type.String(),
    slug: Type.String(),
  })),
  response: {
    200: Post,
    404: NotFoundResponse,
    409: ConflictResponse,
    429: RateLimitedResponse,
  },
};
