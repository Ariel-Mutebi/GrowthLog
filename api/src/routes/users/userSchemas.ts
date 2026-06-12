import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/generic.js';
import { Alphanumeric, Email, LettersOnlyString, UserRole } from '../../types/typebox.js';

type userFields = Partial<AllUnknown<User>>;

const body = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Type.String(),
  role: UserRole,
} satisfies userFields);

// Note: password omitted so that it's never serialized and sent back.
export const SuccessfulResponse = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  role: UserRole,
  createdAt: Type.Date(),
} satisfies userFields);

const ConflictResponse = Type.Object({
  error: Type.Literal('Conflict'),
  message: Type.String(),
});

const NotFoundResponse = Type.Object({
  error: Type.Literal('NotFound'),
  message: Type.String(),
});

const response = {
  200: SuccessfulResponse,
  404: NotFoundResponse,
  409: ConflictResponse,
} satisfies FastifySchema['response'];

export const CreateUserSchema = { body, response } satisfies FastifySchema;

export const UpdateUserSchema = {
  body: Type.Partial(body),
  response,
} satisfies FastifySchema;

export const ReadOrDeleteUserSchema = {
  response: {
    200: SuccessfulResponse,
    404: NotFoundResponse,
  },
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
    404: NotFoundResponse,
  },
} satisfies FastifySchema;
