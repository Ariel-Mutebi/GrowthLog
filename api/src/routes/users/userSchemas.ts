import { Type } from '@sinclair/typebox';
import { Alphanumeric, Email, ExposedRoles, LettersOnlyString } from '../../types/customTypebox.js';

import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/mappedTypes.js';

export const CreateUserBody = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Type.String(),
  role: ExposedRoles,
} satisfies Partial<AllUnknown<User>>);
