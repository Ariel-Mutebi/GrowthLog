import { Type } from '@sinclair/typebox';
import { NameInput } from '../../typebox/inputs.js';
import {
  BadRequest,
  Conflict,
  NotFound,
  Unauthorized,
  generalErrorResponses,
} from '../../typebox/responses.js';
import {
  UserClientSafe,
  UserPublicSafe,
  UserDeclaredFields,
} from '../../typebox/userTypes.js';
import type { FastifySchema } from 'fastify';
import type { Static } from '@sinclair/typebox';

const IdentityProof = Type.Object({ currentPassword: Type.String() });
export type IdentityProof = Static<typeof IdentityProof>;

export const CreateUserSchema = {
  summary: 'Register a new user',
  description: 'Creates a user account and opens a session. One request per IP per day.',
  tags: ['Users'],
  body: UserDeclaredFields,
  response: {
    201: UserClientSafe,
    400: BadRequest,
    409: Conflict,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetSelfSchema = {
  summary: 'Get current user\'s account details',
  tags: ['Users'],
  security: [{ session: [] }],
  response: {
    200: UserClientSafe,
    401: Unauthorized,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const UpdateSelfSchema = {
  summary: 'Update current user',
  description: 'Updating email or password requires `currentPassword` to be provided.',
  tags: ['Users'],
  security: [{ session: [] }],
  body: Type.Composite(
    [
      Type.Partial(IdentityProof),
      Type.Partial(UserDeclaredFields),
    ],
    { additionalProperties: false },
  ),
  response: {
    200: UserClientSafe,
    400: BadRequest,
    401: Unauthorized,
    409: Conflict,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const DeleteSelfSchema = {
  summary: 'Delete current user',
  description: 'Soft deletes the account. The account can be recovered by logging in within 7 days.',
  tags: ['Users'],
  security: [{ session: [] }],
  body: IdentityProof,
  response: {
    200: UserClientSafe,
    401: Unauthorized,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetUserSchema = {
  summary: 'Get a user\'s public data',
  tags: ['Users'],
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    200: UserPublicSafe,
    401: Unauthorized,
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const UserSearchSchema = {
  summary: 'User discovery endpoint',
  description: 'Search for users by name and/or interests (tags on their published posts)',
  tags: ['Users'],
  querystring: Type.Object(
    {
      name: Type.Optional(Type.String({ minLength: 1, maxLength: 100, pattern: '\\S' })),
      interests: Type.Optional(Type.Array(NameInput)),
      cursor: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
    },
    // at least one of name / interest must be present
    { anyOf: [{ required: ['name'] }, { required: ['interests'] }] },
  ),
  response: {
    200: Type.Object({
      users: Type.Array(UserPublicSafe),
      nextCursor: Type.Union([Type.String(), Type.Null()]),
    }),
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
