import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { ConflictResponse, NotFoundResponse, RateLimitedResponse } from '../../typebox/responses.js';
import { OptionalDate, SerializedDate } from '../../typebox/date.js';

const DraftMeta = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  id: Type.String(),
  authorId: Type.String(),
  publishedAt: OptionalDate,
  createdAt: SerializedDate,
  updatedAt: SerializedDate,
  deletedAt: OptionalDate,
});

export const GetMyPostsSchema = {
  summary: 'Get all your posts',
  description: 'Get the metadata for all of your posts (content excluded)',
  security: [{ session: [] }],
  tags: ['Posts'],
  response: {
    200: Type.Array(DraftMeta),
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const CreateDraftSchema = {
  summary: 'Create a new blog post draft',
  description: 'Create an empty blog post draft with a title and slug (slug is derived from title if absent)',
  security: [{ session: [] }],
  tags: ['Posts'],
  body: Type.Object({
    title: Type.String(),
    slug: Type.String(),
  }),
  response: {
    201: DraftMeta,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const UpdatePostMetadata = {
  summary: 'Update a post\'s metadata',
  description: 'Update the title and slug of a post',
  security: [{ session: [] }],
  tags: ['Posts'],
  params: Type.Object({
    postId: Type.String(),
  }),
  body: Type.Partial(Type.Object({
    title: Type.String(),
    slug: Type.String(),
  })),
  response: {
    200: DraftMeta,
    404: NotFoundResponse,
    409: ConflictResponse,
    429: RateLimitedResponse,
  },
};
