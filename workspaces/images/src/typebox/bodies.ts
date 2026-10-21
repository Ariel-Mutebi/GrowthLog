import { Type } from '@sinclair/typebox';

export const RequestUploadBody = Type.Object({
  mimeType: Type.Union([
    Type.Literal('image/jpeg'),
    Type.Literal('image/png'),
    Type.Literal('image/webp'),
  ]),
  sizeBytes: Type.Integer({ minimum: 0 }),
});
