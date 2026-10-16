import { Type } from '@sinclair/typebox';
import { NameInput, Username, BioInput, Email } from './inputs.js';
import type { TypeBoxModel } from './mapping.js';
import type { Editable, IdentityProof, Personal, PublicUser } from '../services/users/shared/interfaces.js';

export const EditableFields = Type.Object({
  forename: NameInput,
  surname: NameInput,
  username: Type.Optional(Username),
  bio: Type.Optional(BioInput),
  email: Email,
  password: Type.String(),
} satisfies TypeBoxModel<Editable>);

export const PublicUserObject = Type.Object({
  id: Type.String(),
  forename: Type.String(),
  surname: Type.String(),
  username: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.Date(),
} satisfies TypeBoxModel<PublicUser>);

export const PersonalFields = Type.Object({
  id: Type.String(),
  forename: Type.String(),
  surname: Type.String(),
  username: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  email: Type.String(),
  createdAt: Type.Date(),
} satisfies TypeBoxModel<Personal>);

export const IdentityObject = Type.Object({
  passwordAttempt: Type.String(),
} satisfies TypeBoxModel<IdentityProof>);
