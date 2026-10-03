import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { Email } from '../../typebox/inputs.js';
import { UserClientSafe } from '../../typebox/userTypes.js';
import { UnauthorizedResponse, RateLimitedResponse } from '../../typebox/responses.js';

export const CreateSessionSchema = {
  summary: 'Log in',
  description: 'Authenticates with email and password and opens a session. Limited to 5 failed attempts per account per 15 minutes.',
  tags: ['Sessions'],
  body: Type.Object({
    email: Email,
    password: Type.String(),
  }),
  response: {
    200: UserClientSafe,
    401: UnauthorizedResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;

export const DeleteSessionSchema = {
  summary: 'Log out',
  description: 'Destroys the current session.',
  tags: ['Sessions'],
  security: [{ session: [] }],
  response: {
    204: Type.Null(),
    401: UnauthorizedResponse,
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;
