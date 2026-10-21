import { Type } from '@sinclair/typebox';
import { ImageModel } from './models.js';
import type { FastifySchema } from 'fastify';

export const BadRequest = Type.Object({
  error: Type.Literal('BadRequest'),
  message: Type.String(),
});

export const Unauthorized = Type.Object({
  error: Type.Literal('Unauthorized'),
  message: Type.String(),
});

export const NotFound = Type.Object({
  error: Type.Literal('NotFound'),
  message: Type.String(),
});

export const InternalServerError = Type.Object({
  error: Type.Literal('InternalServerError'),
  message: Type.String(),
});

export const UnprocessableEntity = Type.Object({
  error: Type.Literal('UnprocessableEntity'),
  message: Type.String(),
});

export const PayloadTooLarge = Type.Object({
  error: Type.Literal('PayloadTooLarge'),
  message: Type.String(),
});

export const Conflict = Type.Object({
  error: Type.Literal('Conflict'),
  message: Type.String(),
});

export const TooEarly = Type.Object({
  error: Type.Literal('TooEarly'),
  message: Type.String(),
});

export const RequestUploadResponse = {
  200: Type.Object({
    imageId: Type.String(),
    uploadUrl: Type.String(),
  }),
  400: BadRequest,
  401: Unauthorized,
  413: PayloadTooLarge,
  500: InternalServerError,
} satisfies FastifySchema['response'];

export const ConfirmResponse = {
  200: ImageModel,
  401: Unauthorized,
  404: NotFound,
  409: Conflict,
  413: PayloadTooLarge,
  422: UnprocessableEntity,
  425: TooEarly,
  500: InternalServerError,
} satisfies FastifySchema['response'];
