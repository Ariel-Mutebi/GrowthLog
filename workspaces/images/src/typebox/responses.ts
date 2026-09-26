import { Type } from '@sinclair/typebox';

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
