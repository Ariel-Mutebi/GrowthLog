import type { User } from '../db/client.js';
import type { SerializedUser } from '../types/userTypes.js';

export async function serializeUser(user: User) {
  return {
    id: user.id,
    role: user.role,
  } satisfies SerializedUser;
};
