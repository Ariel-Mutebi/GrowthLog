import type { PassportUser } from 'fastify';
import type { User } from '@growthlog/db';

export async function serializeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
  } satisfies PassportUser;
};
