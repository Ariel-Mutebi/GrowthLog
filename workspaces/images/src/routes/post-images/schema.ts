import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import {
  BadRequest,
  NotFound,
  Unauthorized,
  InternalServerError,
  Conflict,
  PayloadTooLarge,
  UnprocessableEntity,
  TooEarly,
} from '../../typebox/responses.js';
import { headers } from '../../typebox/headers.js';
import { ImageModel } from '../../typebox/models.js';
import { allowedMimeTypes } from '../../typebox/mime.js';

export const RequestUpload = {
  summary: 'Request post image upload',
  description: 'Returns the image ID and a presigned PUT URL to Minio',
  headers,
  params: Type.Object({
    postId: Type.String(),
  }),
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
  summary: 'Confirm post image upload',
  description: 'Checks if the uploaded object follows the rules and updates the image status',
  headers,
  params: Type.Object({
    postId: Type.String(),
    imageId: Type.String(),
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
