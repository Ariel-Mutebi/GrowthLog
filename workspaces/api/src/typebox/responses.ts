import { Type } from '@sinclair/typebox';

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

export const LockedResponse = Type.Object({
  error: Type.Literal('Locked'),
  message: Type.String(),
});

export const RateLimitedResponse = Type.Object({
  error: Type.String(),
  message: Type.String(),
});
