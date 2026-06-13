import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { Email } from '../../types/typebox.js';
import { UserWithoutInternals } from '../users/userSchemas.js';

const credentials = Type.Object({
  email: Email,
  password: Type.String(),
});

const UnauthorizedResponse = Type.Object({
  error: Type.Literal('Unauthorized'),
  message: Type.String(),
});

export const CreateSessionSchema = {
  body: credentials,
  response: {
    200: UserWithoutInternals,
    401: UnauthorizedResponse,
  },
} satisfies FastifySchema;
