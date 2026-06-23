import { Type } from '@sinclair/typebox';
import { SerializedDate } from './compatability.js';
import { LettersOnlyString, Username, Email, UserRole } from './inputs.js';

export const InternalUser = Type.Object({
  id: Type.String(),
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Username,
  email: Email,
  role: UserRole,
  createdAt: SerializedDate,
});

export const PersonalProfile = Type.Object({
  id: Type.String(),
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Username,
  email: Email,
  role: UserRole,
  createdAt: SerializedDate,
  following: Type.Array(Type.String()),
  followers: Type.Array(Type.String()),
});

export const PublicProfile = Type.Object({
  id: Type.String(),
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Username,
  role: UserRole,
  createdAt: SerializedDate,
});
