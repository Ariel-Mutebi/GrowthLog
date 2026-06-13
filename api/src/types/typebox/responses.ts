import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';

export const ConflictResponse = Type.Object({
  error: Type.Literal('Conflict'),
  message: Type.String(),
});

export const NotFoundResponse = Type.Object({
  error: Type.Literal('NotFound'),
  message: Type.String(),
});

export const UnauthorizedResponse = Type.Object({
  error: Type.Literal('Unauthorized'),
  message: Type.String(),
});

export const BadRequest = Type.Object({
  error: Type.Literal('BadRequest'),
  message: Type.String(),
  suggestions: Type.Optional(
    Type.Array(Type.String()),
  ),
});

export const errorResponses = {
  400: BadRequest,
  401: UnauthorizedResponse,
  404: NotFoundResponse,
  409: ConflictResponse,
} satisfies FastifySchema['response'];
