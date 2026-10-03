import { Type } from '@sinclair/typebox';
import type { Post } from '@growthlog/db';
import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '../../typebox/mapping.js';
import { UnauthorizedResponse, generalErrorResponses } from '../../typebox/responses.js';
import { OptionalDate, SerializableDate } from '../../typebox/date.js';

export type PostMetadata = Omit<Post, 'draftContent' | 'publishedHtml' | 'deletedAt'>;

const PostMetadata = Type.Object({
  id: Type.String(),
  authorId: Type.String(),
  title: Type.String(),
  slug: Type.Union([Type.String(), Type.Null()]),
  publishedAt: OptionalDate,
  createdAt: SerializableDate,
  updatedAt: SerializableDate,
} satisfies TypeBoxModel<PostMetadata>);

export const CreateBlankPost = {
  summary: 'Create',
  description: 'Creates a blank post',
  tags: ['Posts'],
  security: [{ session: [] }],
  response: {
    201: PostMetadata,
    401: UnauthorizedResponse,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
