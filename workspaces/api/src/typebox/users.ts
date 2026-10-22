import { Type } from '@sinclair/typebox';
import { SerializableDate } from './date.js';
import { NameInput, Username, BioInput, Email, NonEmpty } from './inputs.js';

import type { TypeBoxModel } from './mapping.js';
import type {
  Editable,
  IdentityProof,
  Personal,
  PublicUser,
} from '../services/users/shared/interfaces.js';

export const EditableFields = Type.Object({
  forename: NameInput,
  surname: NameInput,
  username: Type.Optional(Username),
  bio: Type.Optional(BioInput),
  email: Email,
  password: NonEmpty,
} satisfies TypeBoxModel<Editable>, { additionalProperties: false });

export const PublicUserObject = Type.Object({
  id: Type.String(),
  forename: Type.String(),
  surname: Type.String(),
  username: Type.String(),
  createdAt: SerializableDate,
  bio: Type.Union([Type.String(), Type.Null()]),
  avatarKey: Type.Union([Type.String(), Type.Null()]),
} satisfies TypeBoxModel<PublicUser>);

export const PersonalObject = Type.Object({
  id: Type.String(),
  forename: Type.String(),
  surname: Type.String(),
  username: Type.String(),
  email: Type.String(),
  createdAt: SerializableDate,
  bio: Type.Union([Type.String(), Type.Null()]),
  avatarKey: Type.Union([Type.String(), Type.Null()]),
} satisfies TypeBoxModel<Personal>);

export const IdentityObject = Type.Object({
  passwordAttempt: Type.String(),
} satisfies TypeBoxModel<IdentityProof>);
