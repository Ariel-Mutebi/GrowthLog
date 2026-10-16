import { compare, hash } from 'bcrypt';
import { personalSelect } from './shared/selectors.js';
import { ForbiddenError, UserConflictError } from './shared/errors.js';
import { HASHING_ROUNDS } from './shared/constants.js';
import { assertStrongPassword, flattenAvatarKey } from './shared/helpers.js';

import { PrismaClientKnownRequestError, type PrismaClient } from '@growthlog/db';
import type { Editable, Personal, IdentityProof } from './shared/interfaces.js';

export class PersonalService {
  constructor(private readonly prisma: PrismaClient) {}

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
      await this.assertCorrectPassword(id, passwordAttempt);
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

  public async deleteSelf(id: string, passwordAttempt: string): Promise<Personal> {
    await this.assertCorrectPassword(id, passwordAttempt);

    const deleted = await this.prisma.user.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
      select: personalSelect,
    });

    return flattenAvatarKey(deleted);
  }

  private async assertCorrectPassword(id: string, attempt?: string) {
    if (!attempt) throw new ForbiddenError();

    const { password } = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { password: true },
    });

    if (!(await compare(attempt, password))) throw new ForbiddenError();
  }
}
