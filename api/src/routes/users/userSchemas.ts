import { Type } from '@sinclair/typebox';

import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/mappedTypes.js';
import { Alphanumeric, Email, ExposedRoles, LettersOnlyString } from '../../types/customTypebox.js';

type userFields = Partial<AllUnknown<User>>;

export const CreateUserBody = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Type.String(),
  role: ExposedRoles,
} satisfies userFields);
