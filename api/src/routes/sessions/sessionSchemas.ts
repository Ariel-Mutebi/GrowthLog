import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { Email } from '../../types/typebox/inputs.js';
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
  summary: 'Log in',
  description: 'Authenticates with email and password and opens a session. Limited to 5 failed attempts per account per 15 minutes.',
  tags: ['Sessions'],
  body: credentials,
  response: {
    200: UserWithoutInternals,
    401: UnauthorizedResponse,
  },
} satisfies FastifySchema;

export const DeleteSessionSchema = {
  summary: 'Log out',
  description: 'Destroys the current session.',
  tags: ['Sessions'],
  security: [{ session: [] }],
  response: {
    204: Type.Null(),
  },
} satisfies FastifySchema;
