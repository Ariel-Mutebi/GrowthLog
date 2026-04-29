import { Type } from '@sinclair/typebox';
import { Alphanumeric, Email, LettersOnlyString } from '../stringSchemas.js';

import type { User } from '../../db/client.js';
import type { AllUnknown } from '../../types/mappedTypes.js';

export const CreateUserBody = Type.Object({
  forename: LettersOnlyString,
  surname: LettersOnlyString,
  username: Alphanumeric,
  email: Email,
  password: Type.String(),
} satisfies Partial<AllUnknown<User>>);
