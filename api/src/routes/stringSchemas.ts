import { Type } from '@sinclair/typebox';

export const NonEmptyString = Type.String({
  pattern: '\\S',
});

export const LettersOnlyString = Type.String({
  pattern: '^[A-Za-z]+$',
});

export const Alphanumeric = Type.String({
  pattern: '^[A-Za-z0-9]+$',
});

export const Email = Type.String({
  format: 'email',
});
