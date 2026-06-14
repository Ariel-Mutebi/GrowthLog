import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/generic.js';
import {
  Alphanumeric,
  Email,
  LettersOnlyString,
  NonModeratorRole,
  Password,
  UserRole,
} from '../../types/typebox/inputs.js';
import { errorResponses } from '../../types/typebox/responses.js';

type UserFields = Partial<AllUnknown<User>>;

const CreateUser = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Password,
  role: NonModeratorRole,
} satisfies UserFields);

const revalidateIdentity = Type.Object({
  currentPassword: Password,
});

// Hashed password and internal deletedAt flag omitted
export const UserWithoutInternals = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  role: UserRole,
  createdAt: Type.Date(),
} satisfies Omit<UserFields, 'password' | 'deletedAt'>);

const response = {
  200: UserWithoutInternals,
  ...errorResponses,
};

export const CreateUserSchema = {
  summary: 'Register a new user',
  description: 'Creates a user account and opens a session. Rate limited to one registration per IP per day.',
  tags: ['Users'],
  body: CreateUser,
  response,
} satisfies FastifySchema;

export const ReadUserSchema = {
  summary: 'Get current user',
  tags: ['Users'],
  security: [{ session: [] }],
  response,
} satisfies FastifySchema;

export const UpdateUserSchema = {
  summary: 'Update current user',
  description: 'Updating email or password requires `currentPassword` to be provided.',
  tags: ['Users'],
  security: [{ session: [] }],
  body: Type.Intersect([
    Type.Partial(revalidateIdentity),
    Type.Partial(CreateUser),
  ]),
  response,
} satisfies FastifySchema;

export const DeleteUserSchema = {
  summary: 'Delete current user',
  description: 'Soft deletes the account. The account can be recovered by logging in within 7 days.',
  tags: ['Users'],
  security: [{ session: [] }],
  body: revalidateIdentity,
  response,
} satisfies FastifySchema;

const PublicProfile = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  role: UserRole,
  createdAt: Type.Date(),
});

export const PublicProfileSchema = {
  summary: 'Get a user\'s public profile',
  tags: ['Users'],
  security: [{ session: [] }],
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    200: PublicProfile,
    ...errorResponses,
  },
} satisfies FastifySchema;
