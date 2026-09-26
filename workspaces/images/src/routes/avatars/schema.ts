import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import {
  BadRequest,
  NotFound,
  Unauthorized,
  InternalServerError,
} from '../../typebox/responses.js';
import { ImageModel } from '../../typebox/models.js';

export const RequestUpload = {
  body: Type.Object({
    token: Type.String(),
    mimeType: Type.Union([
      Type.Literal('image/jpeg'),
      Type.Literal('image/png'),
      Type.Literal('image/webp'),
    ]),
    sizeBytes: Type.Integer({ minimum: 0 }),
  }),
  response: {
    200: Type.Object({
      imageId: Type.String(),
      uploadUrl: Type.String(),
    }),
    400: BadRequest,
    401: Unauthorized,
  },
} satisfies FastifySchema;

export const Confirm = {
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Object({
    token: Type.String(),
  }),
  response: {
    200: ImageModel,
    401: Unauthorized,
    404: NotFound,
    500: InternalServerError,
  },
} satisfies FastifySchema;
