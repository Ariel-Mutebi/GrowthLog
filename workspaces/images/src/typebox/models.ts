import { Type } from '@sinclair/typebox';
import type { Image } from '@growthlog/db';
import type { TypeBoxModel } from './mapping.js';

export const ImageModel = Type.Object({
  id: Type.String(),
  key: Type.String(),
  mimeType: Type.String(),
  sizeBytes: Type.Number(),
  width: Type.Union([Type.Number(), Type.Null()]),
  height: Type.Union([Type.Number(), Type.Null()]),
  format: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  createdAt: Type.Date(),
  updatedAt: Type.Date(),
  uploaderId: Type.String(),
} satisfies TypeBoxModel<Image>);
