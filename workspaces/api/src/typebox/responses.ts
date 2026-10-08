import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';

export const Conflict = Type.Object({
  error: Type.Literal('Conflict'),
  message: Type.String(),
});

export const NotFound = Type.Object({
  error: Type.Literal('NotFound'),
  message: Type.String(),
});

export const Unauthorized = Type.Object({
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

export const Locked = Type.Object({
  error: Type.Literal('Locked'),
  message: Type.String(),
});

export const RateLimited = Type.Object({
  error: Type.Literal('RateLimited'),
  message: Type.String(),
});

export const InternalServerError = Type.Object({
  error: Type.Literal('InternalServerError'),
  message: Type.String(),
});

export const generalErrorResponses = {
  429: RateLimited,
  500: InternalServerError,
} satisfies FastifySchema['response'];
