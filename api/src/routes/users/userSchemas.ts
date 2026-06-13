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

export const CreateUserSchema = { body: CreateUser, response } satisfies FastifySchema;

export const UpdateUserSchema = {
  body: Type.Intersect([
    Type.Partial(revalidateIdentity),
    Type.Partial(CreateUser),
  ]),
  response,
} satisfies FastifySchema;

export const ReadUserSchema = { response } satisfies FastifySchema;

export const DeleteUserSchema = {
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
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    200: PublicProfile,
    ...errorResponses,
  },
} satisfies FastifySchema;
