import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import {
  BadRequest,
  generalErrorResponses,
} from '../../typebox/responses.js';

export const RequestSchema = {
  summary: 'Request email verification',
  description: 'Sends a six-digit code to your email',
  security: [{ session: [] }],
  response: {
    204: Type.Null(),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const ConfirmSchema = {
  summary: 'Confirm email verification',
  description: 'Confirms if the email verification code is valid',
  security: [{ session: [] }],
  body: Type.Object({
    code: Type.String({ minLength: 0, maxLength: 6 }),
  }),
  response: {
    204: Type.Null(),
    400: BadRequest,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
