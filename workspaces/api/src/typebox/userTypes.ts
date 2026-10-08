import { Type, type TSchema, type Static } from '@sinclair/typebox';
import { SerializableDate } from './date.js';
import { NameInput, Username, Email, BioInput } from './inputs.js';

import type { User } from '@growthlog/db';
import type { TypeBoxModel } from './mapping.js';

type FullUser = Omit<User, 'deletedAt' | 'avatarId' | 'sessionsRevokedAt' | 'emailVerifiedAt'> & {
  avatarKey: string | null; // transformed from avatarId
}

export type UserClientSafe = Omit<FullUser, 'password'>;
export type UserPublicSafe = Omit<UserClientSafe, 'email'>;

const PublicSafeBase = {
  id: Type.String(),
  forename: NameInput,
  surname: NameInput,
  username: Username,
  createdAt: SerializableDate,
  avatarKey: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([BioInput, Type.Null()]),
} satisfies TypeBoxModel<UserPublicSafe>;
export const UserPublicSafe = Type.Object(PublicSafeBase);

const ClientSafeBase = {
  ...PublicSafeBase,
  email: Email,
} satisfies TypeBoxModel<UserClientSafe>;
export const UserClientSafe = Type.Object(ClientSafeBase);

export const FullUser = Type.Object({
  ...ClientSafeBase,
  password: Type.String(),
} satisfies TypeBoxModel<FullUser>);

export const UserDeclaredFields = Type.Object({
  forename: NameInput,
  surname: NameInput,
  username: Type.Optional(Username),
  email: Email,
  password: Type.String(),
  bio: Type.Optional(BioInput),
} satisfies Partial<Record<keyof User, TSchema>>, { additionalProperties: false });

export type UserDeclaredFields = Static<typeof UserDeclaredFields>;
