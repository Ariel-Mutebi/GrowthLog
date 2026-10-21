import { compare, hashSync } from 'bcrypt';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';
import type { Personal } from './shared/interfaces.js';
import { personalSelect } from './shared/selectors.js';
import { flattenAvatarKey } from './shared/helpers.js';
import { HASHING_ROUNDS, LOCK_WINDOW_SECONDS, MAX_ATTEMPTS } from './shared/constants.js';

/**
 * Timing attack hardening: always run compare, even when no user is found, so
 * response time is consistent regardless of whether the email is registered.
 */
const DUMMY_HASH = hashSync('invalid', HASHING_ROUNDS);
const RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type LoginResult =
  | { status: 'ok'; user: Personal }
  | { status: 'invalid' }
  | { status: 'locked' }
  | { status: 'expired' };

export type LoginFailure = Exclude<LoginResult, { status: 'ok' }>['status'];

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisClientType,
    private readonly prefix = '',
  ) { }

  private attemptsKey(email: string): string {
    return `${this.prefix}failed_login:${email}`;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    email = email.toLocaleLowerCase();
    const key = this.attemptsKey(email);

    /*
     * Reserve the attempt BEFORE the slow bcrypt compare. Incrementing atomically means
     * N parallel requests get N distinct numbers, so only the first 5 get to guess.
     * EXPIRE NX in the same MULTI means the counter can never exist without a TTL.
     */
    const [attempts] = await this.redis
      .multi()
      .incr(key)
      .expire(key, LOCK_WINDOW_SECONDS, 'NX')
      .exec();

    if (Number(attempts) > MAX_ATTEMPTS) {
      return { status: 'locked' };
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...personalSelect,
        password: true,
        deletedAt: true,
      },
    });

    const match = await compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !match) {
      return { status: 'invalid' };
    }

    await this.redis.del(key);

    // Soft-deleted accounts can be restored by logging back in within the recovery window.
    if (user.deletedAt) {
      if (user.deletedAt.getTime() < Date.now() - RESTORE_WINDOW_MS) {
        return { status: 'expired' };
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: null },
      });
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
  }
}
