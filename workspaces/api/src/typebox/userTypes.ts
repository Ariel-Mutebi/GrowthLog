import { Type, type TSchema } from '@sinclair/typebox';
import { SerializableDate } from './date.js';
import { NameInput, Username, Email, BioInput } from './inputs.js';

import type { User } from '@growthlog/db';
import type { TypeBoxModel } from './mapping.js';

export type FullUserType = Omit<User, 'deletedAt'>;
export type UserClientSafeType = Omit<FullUserType, 'password'>;
export type UserPublicSafeType = Omit<UserClientSafeType, 'email'>;

const PublicSafeBase = {
  id: Type.String(),
  forename: NameInput,
  surname: NameInput,
  username: Username,
  createdAt: SerializableDate,
  avatarId: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([BioInput, Type.Null()]),
} satisfies TypeBoxModel<UserPublicSafeType>;
export const UserPublicSafe = Type.Object(PublicSafeBase);

const ClientSafeBase = {
  ...PublicSafeBase,
  email: Email,
} satisfies TypeBoxModel<UserClientSafeType>;
export const UserClientSafe = Type.Object(ClientSafeBase);

export const FullUser = Type.Object({
  ...ClientSafeBase,
  password: Type.String(),
} satisfies TypeBoxModel<FullUserType>);

export const UserDeclaredFields = Type.Object({
  forename: NameInput,
  surname: NameInput,
  username: Username,
  email: Email,
  password: Type.String(),
  avatarId: Type.Optional(Type.String()),
  bio: Type.Optional(BioInput),
} satisfies Partial<Record<keyof User, TSchema>>);
