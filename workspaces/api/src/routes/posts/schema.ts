import { Type, type Static } from '@sinclair/typebox';
import type { Post } from '@growthlog/db';
import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '../../typebox/mapping.js';
import {
  Conflict,
  NotFound,
  TooEarly,
  Unauthorized,
  UnprocessableEntity,
  generalErrorResponses,
} from '../../typebox/responses.js';
import { OptionalDate, SerializableDate } from '../../typebox/date.js';

export type PostMetadata = Omit<Post, 'draftContent' | 'publishedHtml' | 'deletedAt'>;

const PostMetadata = Type.Object({
  id: Type.String(),
  authorId: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  coverImageId: Type.Union([Type.String(), Type.Null()]),
  publishedSlug: Type.Union([Type.String(), Type.Null()]),
  publishedTitle: Type.Union([Type.String(), Type.Null()]),
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
    401: Unauthorized,
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
    401: Unauthorized,
    404: NotFound,
    409: Conflict,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetOwnPost = {
  summary: 'Get own post',
  description: 'Get one of your own post\'s public metadata',
  security: [{ session: [] }],
  tags: ['Posts'],
  params: Type.Object({
    slug: Type.String(),
  }),
  response: {
    200: PostMetadata,
    401: Unauthorized,
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const PostSortField = Type.Union([
  Type.Literal('title'),
  Type.Literal('updatedAt'),
]);

export const SortOrder = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
]);

export const GetOwnPostsQuery = Type.Object({
  sortBy: Type.Optional(PostSortField),
  order: Type.Optional(SortOrder),
  published: Type.Optional(Type.Boolean()),
});

export type PostQueryOptions = Static<typeof GetOwnPostsQuery>;

export const GetOwnPosts = {
  summary: 'Get own posts',
  description: 'Get your own posts, filtered and sorted',
  security: [{ session: [] }],
  tags: ['Posts'],
  querystring: GetOwnPostsQuery,
  response: {
    200: Type.Array(PostMetadata),
    401: Unauthorized,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const PublishPost = {
  summary: 'Publish post',
  description: 'Make your own post publicly discoverable',
  security: [{ session: [] }],
  tags: ['Posts'],
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Object({
    publishedSlug: Type.String(),
    publishedTitle: Type.String(),
    publishedHook: Type.String(),
    coverImageId: Type.String(),
  }),
  response: {
    200: PostMetadata,
    400: NotFound,
    401: Unauthorized,
    409: Conflict,
    422: UnprocessableEntity,
    425: TooEarly,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const Prepublish = {
  summary: 'Prepublish',
  description: 'Get reasonable defaults for publish data to reduce user friction',
  security: [{ session: [] }],
  tags: ['Posts'],
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: Type.Object({
      publishedSlug: Type.String(),
      publishedTitle: Type.String(),
      publishedHook: Type.String(),
      coverImageId: Type.Union([Type.String(), Type.Null()]),
      coverImageKey: Type.Union([Type.String(), Type.Null()]),
    }),
    400: NotFound,
    401: Unauthorized,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
