import { Type } from '@sinclair/typebox';
import type { Image } from '@growthlog/db';
import type { TypeBoxModel } from './mapping.js';
import { SerializableDate } from './date.js';

export const ImageModel = Type.Object({
  id: Type.String(),
  key: Type.String(),
  mimeType: Type.String(),
  sizeBytes: Type.Number(),
  width: Type.Union([Type.Number(), Type.Null()]),
  height: Type.Union([Type.Number(), Type.Null()]),
  status: Type.String(),
  createdAt: SerializableDate,
  updatedAt: SerializableDate,
  uploaderId: Type.String(),
} satisfies TypeBoxModel<Image>);
