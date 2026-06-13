import { Type } from '@sinclair/typebox';

export const Password = Type.String({ minLength: 12 });

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

export const NonModeratorRole = Type.Union([
  Type.Literal('ADVERTISER'),
  Type.Literal('AUTOBIOGRAPHER'),
  Type.Literal('BIOGRAPHER'),
]);

export const UserRole = Type.Union([
  Type.Literal('ADVERTISER'),
  Type.Literal('AUTOBIOGRAPHER'),
  Type.Literal('BIOGRAPHER'),
  Type.Literal('MODERATOR'),
]);
