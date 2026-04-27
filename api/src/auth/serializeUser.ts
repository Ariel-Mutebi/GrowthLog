import type { User } from '../../prisma/generated/client.js';

export async function serializeUser(user: User) {
  return user.id;
};
