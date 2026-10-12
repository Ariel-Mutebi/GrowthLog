import { Type } from '@sinclair/typebox';

export const allowedMimeTypes = Type.Union([
  Type.Literal('image/jpeg'),
  Type.Literal('image/png'),
  Type.Literal('image/webp'),
]);
