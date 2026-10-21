import { compare, hash } from 'bcrypt';
import { personalSelect } from './shared/selectors.js';
import { HASHING_ROUNDS, MAX_ATTEMPTS, LOCK_WINDOW_SECONDS } from './shared/constants.js';
import { ForbiddenError, UserConflictError, AccountLockedError } from './shared/errors.js';
import { assertStrongPassword, flattenAvatarKey } from './shared/helpers.js';

import { PrismaClientKnownRequestError, type PrismaClient } from '@growthlog/db';
import type { RedisClientType } from 'redis';
import type { Editable, Personal, IdentityProof } from './shared/interfaces.js';

export class PersonalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisClientType,
    private readonly prefix = '',
  ) {}

  public async getSelf(id: string): Promise<Personal> {
    const self = await this.prisma.user.findUniqueOrThrow({
      where: {
        id,
        deletedAt: null,
      },
      select: personalSelect,
    });

    return flattenAvatarKey(self);
  }

  public async updateSelf(id: string, data: Partial<Editable & IdentityProof>): Promise<Personal> {
    const { passwordAttempt, ...updates } = data;

    if (updates.email || updates.password) {
      await this.checkPassword(id, passwordAttempt);
    }

    if (updates.password) {
      assertStrongPassword(updates.password);
      updates.password = await hash(updates.password, HASHING_ROUNDS);
    }

    try {
      const updated = await this.prisma.user.update({
        where: {
          id,
          deletedAt: null,
        },
        data: {
          ...updates,
          ...(updates.email ? { emailVerifiedAt: null } : {}),
          ...(updates.password ? { sessionsRevokedAt: new Date() } : {}),
        },
        select: personalSelect,
      });
      
      return flattenAvatarKey(updated);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UserConflictError();
      }
      throw error;
    }
  }

  public async deleteSelf(id: string, passwordAttempt: string): Promise<void> {
    await this.checkPassword(id, passwordAttempt);

    await this.prisma.user.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private attemptsKey(id: string) {
    return `${this.prefix}failed_password_check:${id}`;
  }

  private async checkPassword(id: string, attempt?: string) {
    if (!attempt) throw new ForbiddenError();

    const key = this.attemptsKey(id);
    const [attempts] = await this.redis
      .multi()
      .incr(key)
      .expire(key, LOCK_WINDOW_SECONDS, 'NX')
      .ttl(key)
      .exec();

    if (Number(attempts) > MAX_ATTEMPTS) {
      throw new AccountLockedError();
    }

    const { password } = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { password: true },
    });

    if (!(await compare(attempt, password))) throw new ForbiddenError();

    await this.redis.del(key);
  }
}
