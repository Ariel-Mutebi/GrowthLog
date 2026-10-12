import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import {
  BadRequest,
  NotFound,
  Unauthorized,
  InternalServerError,
  Conflict,
  TooEarly,
  PayloadTooLarge,
  UnprocessableEntity,
} from '../../typebox/responses.js';
import { headers } from '../../typebox/headers.js';
import { ImageModel } from '../../typebox/models.js';
import { allowedMimeTypes } from '../../typebox/mime.js';

export const RequestUpload = {
  summary: 'Request avatar upload',
  description: 'Returns the image ID and a presigned PUT URL to Minio',
  headers,
  body: Type.Object({
    mimeType: allowedMimeTypes,
    sizeBytes: Type.Integer({ minimum: 0 }),
  }),
  response: {
    200: Type.Object({
      imageId: Type.String(),
      uploadUrl: Type.String(),
    }),
    400: BadRequest,
    401: Unauthorized,
    500: InternalServerError,
  },
} satisfies FastifySchema;

export const Confirm = {
  summary: 'Confirm avatar upload',
  description: 'Checks if the uploaded object follows the rules and updates the image status',
  headers,
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: ImageModel,
    401: Unauthorized,
    404: NotFound,
    409: Conflict,
    413: PayloadTooLarge,
    422: UnprocessableEntity,
    425: TooEarly,
    500: InternalServerError,
  },
} satisfies FastifySchema;
