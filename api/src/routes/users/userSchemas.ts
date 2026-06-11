import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';

import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/generic.js';
import { Alphanumeric, Email, LettersOnlyString, ExposedRoles } from '../../types/typebox.js';

type userFields = Partial<AllUnknown<User>>;

const body = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Type.String(),
  role: ExposedRoles,
} satisfies userFields);

// Note: password omitted so that it's never serialized and sent back.
export const SuccessfulResponse = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  role: ExposedRoles,
  createdAt: Type.Date(),
  deletedAt: Type.Optional(Type.Date()),
} satisfies userFields);

export const ConflictResponse = Type.Object({
  error: Type.Literal('Conflict'),
  message: Type.String(),
});

const response = {
  200: SuccessfulResponse,
  409: ConflictResponse,
} satisfies FastifySchema['response'];

export const CreateUserSchema = { body, response } satisfies FastifySchema;

export const UpdateUserSchema = {
  body: Type.Partial(body),
  response,
} satisfies FastifySchema;
