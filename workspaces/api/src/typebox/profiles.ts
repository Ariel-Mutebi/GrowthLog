import { Type } from '@sinclair/typebox';
import { SerializedDate } from './date.js';
import { LettersOnlyString, Username, Email } from './inputs.js';

const StaticMinimalUser = {
  id: Type.String(),
  username: Username,
};

export const MinimalUser = Type.Object(StaticMinimalUser);

const StaticPublicProfile = {
  ...StaticMinimalUser,
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  createdAt: SerializedDate,
};

export const PublicProfile = Type.Object(StaticPublicProfile);

export const InternalUser = Type.Object({ ...StaticPublicProfile, email: Email });
