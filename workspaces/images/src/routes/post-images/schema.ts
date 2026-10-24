import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { CUID, headers } from '../../typebox/headers.js';
import { RequestUploadBody } from '../../typebox/bodies.js';
import { ConfirmResponse, NotFound, RequestUploadResponse } from '../../typebox/responses.js';

export const RequestUpload = {
  summary: 'Request post image upload',
  description: 'Returns the image ID and a presigned PUT URL to Minio',
  headers,
  params: Type.Object({
    postId: CUID,
  }),
  body: RequestUploadBody,
  response: {
    ...RequestUploadResponse,
    404: NotFound,
  },
} satisfies FastifySchema;

export const Confirm = {
  summary: 'Confirm post image upload',
  description: 'Checks if the uploaded object follows the rules and updates the image status',
  headers,
  params: Type.Object({
    postId: CUID,
    imageId: CUID,
  }),
  response: {
    ...ConfirmResponse,
    404: NotFound,
  },
} satisfies FastifySchema;
