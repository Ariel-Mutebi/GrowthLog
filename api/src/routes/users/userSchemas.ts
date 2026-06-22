import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/mapped.js';
import {
  Username,
  Email,
  LettersOnlyString,
  NonModeratorRole,
  Password,
  UserRole,
} from '../../types/typebox/inputs.js';
import { BadRequest, ConflictResponse, NotFoundResponse, RateLimitedResponse, UnauthorizedResponse } from '../../types/typebox/responses.js';
import { InternalUser, PersonalProfile, PublicProfile } from '../../types/typebox/profiles.js';

type UserFields = Partial<AllUnknown<User>>;

const CreateUser = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Username,
  email: Email,
  password: Password,
  role: NonModeratorRole,
} satisfies UserFields);

const UpdateUser = Type.Partial(Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Username,
  email: Email,
  password: Password,
} satisfies UserFields));

const revalidateIdentity = Type.Object({
  currentPassword: Password,
});

export const CreateUserSchema = {
  summary: 'Register a new user',
  description: 'Creates a user account and opens a session. Rate limited to one registration per IP per day.',
  tags: ['Users'],
  body: CreateUser,
  response: {
    201: InternalUser,
    400: BadRequest,
    409: ConflictResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const GetSelfSchema = {
  summary: 'Get current user\'s profile',
  tags: ['Users'],
  security: [{ session: [] }],
  response: {
    200: PersonalProfile,
    404: NotFoundResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const UpdateUserSchema = {
  summary: 'Update current user',
  description: 'Updating email or password requires `currentPassword` to be provided.',
  tags: ['Users'],
  security: [{ session: [] }],
  body: Type.Intersect([Type.Partial(revalidateIdentity), UpdateUser]),
  response: {
    200: InternalUser,
    400: BadRequest,
    401: UnauthorizedResponse,
    409: ConflictResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const DeleteUserSchema = {
  summary: 'Delete current user',
  description: 'Soft deletes the account. The account can be recovered by logging in within 7 days.',
  tags: ['Users'],
  security: [{ session: [] }],
  body: revalidateIdentity,
  response: {
    200: InternalUser,
    401: UnauthorizedResponse,
  },
} satisfies FastifySchema;

export const GetUserSchema = {
  summary: 'Get a user\'s public profile',
  tags: ['Users'],
  security: [{ session: [] }],
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    200: PublicProfile,
    404: NotFoundResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const UserSearchSchema = {
  summary: 'User discovery endpoint',
  description: 'Search for a user by name and role',
  tags: ['Users', 'Discovery'],
  security: [{ session: [] }],
  querystring: Type.Object({
    name: Type.String({ minLength: 1 }),
    role: UserRole,
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  }),
  response: {
    200: Type.Object({
      users: Type.Array(PublicProfile),
      nextCursor: Type.Union([Type.String(), Type.Null()]),
    }),
    404: NotFoundResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;
