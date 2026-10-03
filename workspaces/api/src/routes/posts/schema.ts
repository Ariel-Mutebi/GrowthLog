import { Type } from '@sinclair/typebox';
import type { Post } from '@growthlog/db';
import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '../../typebox/mapping.js';
import {
  ConflictResponse,
  NotFoundResponse,
  UnauthorizedResponse,
  generalErrorResponses,
} from '../../typebox/responses.js';
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
  summary: 'Create post',
  description: 'Creates a blank post',
  tags: ['Posts'],
  security: [{ session: [] }],
  response: {
    201: PostMetadata,
    401: UnauthorizedResponse,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const UpdatePost = {
  summary: 'Update post',
  description: 'Update your own post\'s title or slug',
  tags: ['Posts'],
  security: [{ session: [] }],
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Partial(Type.Object({
    title: Type.String(),
    slug: Type.String(),
  })),
  response: {
    200: PostMetadata,
    401: UnauthorizedResponse,
    404: NotFoundResponse,
    409: ConflictResponse,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetOwnPost = {
  summary: 'Get post',
  description: 'Get one of your own post\'s public metadata',
  security: [{ session: [] }],
  tags: ['Posts'],
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: PostMetadata,
    401: UnauthorizedResponse,
    404: NotFoundResponse,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
