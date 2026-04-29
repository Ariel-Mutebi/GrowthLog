import { Type } from '@sinclair/typebox';
import { Role } from '../db/enums.js';

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
export const ExposedRoles = Type.Enum({
  autobiographer: Role.AUTOBIOGRAPHER,
  biographer: Role.BIOGRAPHER,
  advertiser: Role.ADVERTISER,
});
