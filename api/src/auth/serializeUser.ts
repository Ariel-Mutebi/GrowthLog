import type { User } from '../db/client.js';

export async function serializeUser(user: User) {
  return user.id;
};
