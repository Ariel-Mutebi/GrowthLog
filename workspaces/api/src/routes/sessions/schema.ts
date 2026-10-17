import type { FastifySchema } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PersonalFields } from '../../typebox/users.js';
import { meErrorResponses } from '../../typebox/responses.js';

export const CreateSessionSchema = {
  summary: 'Log in',
  description: 'Authenticates with email and password and opens a session. Limited to 5 failed attempts per account per 15 minutes.',
  tags: ['Sessions'],
  body: Type.Object({
    email: Type.String(),
    password: Type.String(),
  }),
  response: {
    200: PersonalFields,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const DeleteSessionSchema = {
  summary: 'Log out',
  description: 'Destroys the current session.',
  tags: ['Sessions'],
  security: [{ session: [] }],
  response: {
    204: Type.Null(),
    ...meErrorResponses,
  },
} satisfies FastifySchema;
