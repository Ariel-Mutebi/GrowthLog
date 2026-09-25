import { Type } from '@sinclair/typebox';

export const BadRequestResponse = Type.Object({
  error: Type.Literal('BadRequest'),
  message: Type.String(),
});

export const UnauthorizedResponse = Type.Object({
  error: Type.Literal('Unauthorized'),
  message: Type.String(),
});
