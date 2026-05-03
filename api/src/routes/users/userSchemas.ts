import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';

import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/mappedTypes.js';
import { Alphanumeric, Email, ExposedRoles, LettersOnlyString } from '../../types/customTypebox.js';

type userFields = Partial<AllUnknown<User>>;

const CreateUserBody = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Type.String(),
  role: ExposedRoles,
} satisfies userFields);

export const ConflictResponse = Type.Object({
  error: Type.Literal('Conflict'),
  message: Type.String(),
});

const CreateOrUpdateResponse = {
  204: Type.Void(),
  409: ConflictResponse,
} satisfies FastifySchema['response'];

export const CreateUserSchema = {
  body: CreateUserBody,
  response: CreateOrUpdateResponse,
} satisfies FastifySchema;

export const UpdateUserSchema = {
  body: Type.Partial(CreateUserBody),
  response: CreateOrUpdateResponse,
} satisfies FastifySchema;
