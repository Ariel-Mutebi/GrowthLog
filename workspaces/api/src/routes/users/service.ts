import slugify from 'slugify';
import { zxcvbn } from 'zxcvbn-ts';
import { hash, compare } from 'bcrypt';
import { conflictsOn } from '../../utils/extractors.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { clientSafeSelect, publicSafeSelect, flattenAvatarKey } from '../../utils/userSelectors.js';

import type { IdentityProof } from './schema.js';
import type { PrismaClient, UserFindManyArgs, UserWhereInput } from '@growthlog/db';
import type { UserClientSafe, UserPublicSafe, UserDeclaredFields } from '../../typebox/userTypes.js';

const HASHING_ROUNDS = 10;
const MAX_RETRIES = 100;

export class PasswordTooWeakError extends Error {
  constructor (
    public readonly suggestions: readonly string[],
  ) {
    super();
  }
};

export class UserConflictError extends Error { };
export class EmailConflictError extends Error { };
export class UsernameConflictError extends Error { };
export class UserNotFoundError extends Error { };
export class UserMutationUnauthorizedError extends Error { };

interface SearchParams {
  name?: string;
  interests?: string[];
  cursor?: string;
  limit?: number;
}

interface SearchResult {
  users: UserPublicSafe[];
  nextCursor: string | null;
}

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async create(data: UserDeclaredFields): Promise<UserClientSafe> {
    const { password, username, ...rest } = data;

    this.passwordCheck(password);
    const hashedPassword = await hash(password, HASHING_ROUNDS);

    if (username) {
      return await this.simpleCreate({
        username,
        password: hashedPassword,
        ...rest,
      });
    }

    return await this.createWithDerivedUsername({
      password: hashedPassword,
      ...rest,
    });
  }

  private passwordCheck(password: string): void {
    const { score, feedback } = zxcvbn(password);

    if (score < 3) {
      throw new PasswordTooWeakError(feedback.suggestions);
    }
  }

  private async simpleCreate(data: UserDeclaredFields & { username: string }): Promise<UserClientSafe> {
    try {
      const user = await this.prisma.user.create({
        data,
        select: clientSafeSelect,
      });

      return flattenAvatarKey(user);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code == 'P2002') {
        throw new UserConflictError();
      }

      throw error;
    }
  }

  private async createWithDerivedUsername(data: UserDeclaredFields): Promise<UserClientSafe> {
    const { forename, surname, ...rest } = data;
    const base = slugify(`${forename} ${surname}`, { lower: true });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const suffix = attempt > 0 ? `-${attempt}` : '';
      const derived = base + suffix;
      
      try {
        const newUser = await this.prisma.user.create({
          data: {
            username: derived,
            forename,
            surname,
            ...rest,
          },
          select: clientSafeSelect,
        });
        
        return flattenAvatarKey(newUser);
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          if (conflictsOn(error.meta, 'username')) {
            if (attempt < MAX_RETRIES - 1) {
              continue;
            }
            throw new UsernameConflictError();
          }
          if (conflictsOn(error.meta, 'email')) {
            throw new EmailConflictError();
          }
        }

        throw error;
      }
    }

    // for typescript
    throw new Error();
  }

  public async getSelf(id: string): Promise<UserClientSafe> {
    const self = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: clientSafeSelect,
    });

    return flattenAvatarKey(self);
  }

  public async getOther(id: string): Promise<UserPublicSafe> {
    try {
      const other = await this.prisma.user.findUniqueOrThrow({
        where: {
          id,
          deletedAt: null,
        },
        select: publicSafeSelect,
      });

      return flattenAvatarKey(other);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UserNotFoundError();
      }
      throw error;
    }
  }

  public async paginatedSearch(params: SearchParams): Promise<SearchResult> {
    const { name, interests, cursor, limit = 20 } = params;
    if (!name && !interests) throw new UserNotFoundError();

    const filters: UserWhereInput[] = [];

    if (name) {
      const terms = name.trim().split(/\s+/);
      filters.push(
        ...terms.map((term) => ({
          OR: [
            { forename: { contains: term, mode: 'insensitive' as const } },
            { surname: { contains: term, mode: 'insensitive' as const } },
            { username: { contains: term, mode: 'insensitive' as const } },
          ],
        })),
      );
    }

    if (interests && interests.length) {
      filters.push({
        posts: {
          some: {
            publishedAt: { not: null },
            deletedAt: null,
            tags: {
              some: {
                name: {
                  in: interests,
                  mode: 'insensitive',
                },
              },
            },
          },
        },
      });
    }

    const findManyArgs: UserFindManyArgs = {
      where: {
        deletedAt: null,
        AND: filters,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
    };

    if (cursor) {
      findManyArgs.cursor = { id: cursor };
      findManyArgs.skip = 1;
    }

    const rows = await this.prisma.user.findMany({
      ...findManyArgs,
      select: publicSafeSelect,
    });
    const flat = rows.map(user => flattenAvatarKey(user));
    const users = flat.length > limit ? flat.slice(0, limit): flat;

    if (!users.length) throw new UserNotFoundError();
    const nextCursor = flat.length > limit ? users.at(-1)!.id : null;

    return { users, nextCursor };
  }

  public async update(
    userId: string,
    data: Partial<UserDeclaredFields> & Partial<IdentityProof>,
  ): Promise<UserClientSafe> {
    const { currentPassword, ...updateData } = data;

    if (updateData.email || updateData.password) {
      await this.requireCurrentPassword(userId, currentPassword);
    }

    if (updateData.password) {
      this.passwordCheck(updateData.password);
      updateData.password = await hash(updateData.password, HASHING_ROUNDS);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          ...updateData,
          ...(updateData.password ? { sessionsRevokedAt: new Date() } : {}),
        },
        select: clientSafeSelect,
      });

      return flattenAvatarKey(updatedUser);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UserConflictError();
      }

      throw error;
    }
  }

  private async requireCurrentPassword(userId: string, currentPassword?: string) {
    if (!currentPassword) throw new UserMutationUnauthorizedError();

    const { password } = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        password: true,
      },
    });

    if (!(await compare(currentPassword, password))) {
      throw new UserMutationUnauthorizedError();
    }
  }

  public async softDelete(
    userId: string,
    currentPassword: string,
  ): Promise<UserClientSafe & { deletedAt: Date | null }> {
    await this.requireCurrentPassword(userId, currentPassword);

    const deleted = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        deletedAt: new Date(),
      },
      select: {
        ...clientSafeSelect,
        deletedAt: true,
      },
    });

    return flattenAvatarKey(deleted);
  }
}
