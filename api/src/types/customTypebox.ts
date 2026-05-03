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

// A client cannot create an account with the role of a moderator through the API.
export const ExposedRoles = Type.Union([
  Type.Literal('ADVERTISER'),
  Type.Literal('AUTOBIOGRAPHER'),
  Type.Literal('BIOGRAPHER'),
]);
