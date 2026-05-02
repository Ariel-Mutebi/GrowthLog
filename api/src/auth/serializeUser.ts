import type { PassportUser } from 'fastify';
import type { User } from '../db/client.js';

export async function serializeUser(user: User) {
  return {
    id: user.id,
    role: user.role,
  } satisfies PassportUser;
};
