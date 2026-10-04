import { compare, hashSync } from 'bcrypt';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';
import type { UserClientSafe } from '../typebox/userTypes.js';
import { clientSafeSelect, flattenAvatarKey } from '../utils/userSelectors.js';

const ROUNDS = 10;
/**
 * Timing attack hardening: always run compare, even when no user is found, so
 * response time is consistent regardless of whether the email is registered.
 */
const DUMMY_HASH = hashSync('invalid', ROUNDS);

const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_SECONDS = 15 * 60;
const RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type LoginResult =
  | { status: 'ok'; user: UserClientSafe }
  | { status: 'invalid' }
  | { status: 'locked' }
  | { status: 'expired' };

export type LoginFailure = Exclude<LoginResult, { status: 'ok' }>['status'];

export type AuthService = ReturnType<typeof buildAuthService>;

export function buildAuthService(prisma: PrismaClient, redis: RedisClientType, prefix = '') {
  const attemptsKey = (email: string) => `${prefix}failed_login:${email}`;

  return {
    async login(email: string, password: string): Promise<LoginResult> {
      const key = attemptsKey(email);

      /* Reserve the attempt BEFORE the slow bcrypt compare. Incrementing atomically means
       * N parallel requests get N distinct numbers, so only the first 5 get to guess.
       * EXPIRE NX in the same MULTI means the counter can never exist without a TTL.
      */
      const [attempts] = await redis.multi().incr(key).expire(key, LOCK_WINDOW_SECONDS, 'NX').exec();
      if (Number(attempts) > MAX_ATTEMPTS) return { status: 'locked' };

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          ...clientSafeSelect,
          password: true,
          deletedAt: true,
        },
      });

      const match = await compare(password, user?.password ?? DUMMY_HASH);
      if (!user || !match) return { status: 'invalid' };

      await redis.del(key);

      // Soft-deleted accounts can be restored by logging back in within the recovery window.
      if (user.deletedAt) {
        if (user.deletedAt.getTime() < Date.now() - RESTORE_WINDOW_MS) return { status: 'expired' };
        await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } });
      }

      return {
        status: 'ok',
        user: flattenAvatarKey({
          id: user.id,
          forename: user.forename,
          surname: user.surname,
          username: user.username,
          bio: user.bio,
          email: user.email,
          createdAt: user.createdAt,
          avatar: user.avatar,
        }),
      };
    },
  };
}
