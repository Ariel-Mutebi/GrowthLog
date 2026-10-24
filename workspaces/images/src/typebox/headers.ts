import { Type } from '@sinclair/typebox';

export const headers = Type.Object({
  Authorization: Type.String({
    pattern: '^Bearer\\s+\\S+$',
  }),
});

export const CUID = Type.String({
  pattern: '^[a-z][a-z0-9]{23}$',
});
