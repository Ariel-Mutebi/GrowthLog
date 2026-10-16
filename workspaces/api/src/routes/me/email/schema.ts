import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { security } from '../../../typebox/constants.js';
import { BadRequest, meErrorResponses } from '../../../typebox/responses.js';

export const RequestSchema = {
  summary: 'Request email verification',
  description: 'Sends a six-digit code to your email',
  tags: ['Email'],
  security,
  response: {
    204: Type.Null(),
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const ConfirmSchema = {
  summary: 'Confirm email verification',
  description: 'Confirms if the email verification code is valid',
  tags: ['Email'],
  security,
  body: Type.Object({
    code: Type.String({ minLength: 0, maxLength: 6 }),
  }),
  response: {
    204: Type.Null(),
    400: BadRequest,
    ...meErrorResponses,
  },
} satisfies FastifySchema;
