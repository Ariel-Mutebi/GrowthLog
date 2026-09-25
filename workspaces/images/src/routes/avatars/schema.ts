import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { BadRequestResponse, UnauthorizedResponse } from '../../typebox/responses.js';

const MB_MULTIPLIER = 1024 ** 2;

export const RequestUpload = {
  body: Type.Object({
    token: Type.String(),
    mimeType: Type.Union([
      Type.Literal('image/jpeg'),
      Type.Literal('image/png'),
      Type.Literal('image/webp'),
    ]),
    sizeBytes: Type.Integer({
      minimum: 0,
      maximum: 5 * MB_MULTIPLIER,
    }),
  }),
  response: {
    400: BadRequestResponse,
    401: UnauthorizedResponse,
  },
} satisfies FastifySchema;
