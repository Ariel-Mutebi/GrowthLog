import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { CUID, headers } from '../../typebox/headers.js';
import { RequestUploadBody } from '../../typebox/bodies.js';
import { RequestUploadResponse, ConfirmResponse } from '../../typebox/responses.js';

export const RequestUpload = {
  summary: 'Request avatar upload',
  description: 'Returns the image ID and a presigned PUT URL to Minio',
  headers,
  body: RequestUploadBody,
  response: RequestUploadResponse,
} satisfies FastifySchema;

export const Confirm = {
  summary: 'Confirm avatar upload',
  description: 'Checks if the uploaded object follows the rules and updates the image status',
  headers,
  params: Type.Object({
    id: CUID,
  }),
  response: ConfirmResponse,
} satisfies FastifySchema;
