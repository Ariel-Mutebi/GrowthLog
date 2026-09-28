import { zxcvbn } from 'zxcvbn-ts';
import { hash, compare } from 'bcrypt';
import { extractConflictColumns } from '../../utils/extractors.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import type { IdentityProof } from './schema.js';
import type { PrismaClient, UserFindManyArgs, UserWhereInput } from '@growthlog/db';
import type { UserClientSafeType, UserPublicSafeType } from '../../typebox/userTypes.js';

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

interface UserDeclaredFields {
  forename: string;
  surname: string;
  email: string;
  password: string;
  bio?: string;
  avatarId?: string;
  username?: string;
}

interface SearchParams {
  name?: string;
  interests?: string[];
  cursor?: string;
  limit?: number;
}

interface SearchResult {
  users: UserPublicSafeType[];
  nextCursor: string | null;
}

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async create(data: UserDeclaredFields): Promise<UserClientSafeType> {
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

  private passwordCheck(password: string) {
    const { score, feedback } = zxcvbn(password);

    if (score < 3) {
      throw new PasswordTooWeakError(feedback.suggestions);
    }
  }

  private async simpleCreate(data: UserDeclaredFields & { username: string }) {
    try {
      const user = await this.prisma.user.create({
        data,
        omit: {
          password: true,
          deletedAt: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code == 'P2002') {
        throw new UserConflictError();
      }

      throw error;
    }
  }

  private async createWithDerivedUsername(data: UserDeclaredFields) {
    const { forename, surname, ...rest } = data;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const suffix = attempt > 0 ? `-${attempt}` : '';
      const derived = `${forename.toLocaleLowerCase()}-${surname.toLocaleLowerCase()}${suffix}`;
      
      try {
        return await this.prisma.user.create({
          data: {
            username: derived,
            forename,
            surname,
            ...rest,
          },
          omit: {
            password: true,
            deletedAt: true,
          },
        });
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          if (extractConflictColumns(error.meta).includes('username')) {
            if (attempt < MAX_RETRIES - 1) {
              continue;
            }
            throw new UsernameConflictError();
          }
          throw new EmailConflictError();
        }

        throw error;
      }
    }

    // for typescript
    throw new Error();
  }

  public async getSelf(id: string): Promise<UserClientSafeType> {
    try {
      return await this.prisma.user.findUniqueOrThrow({
        where: { id },
        omit: {
          password: true,
          deletedAt: true,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UserNotFoundError();
      }
      throw error;
    }
  }

  public async getOther(id: string): Promise<UserPublicSafeType> {
    try {
      return await this.prisma.user.findUniqueOrThrow({
        where: { id },
        omit: {
          email: true,
          password: true,
          deletedAt: true,
        },
      });
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
      omit: {
        email: true,
        password: true,
        deletedAt: true,
      },
    };

    if (cursor) {
      findManyArgs.cursor = { id: cursor };
      findManyArgs.skip = 1;
    }

    const rows = await this.prisma.user.findMany(findManyArgs);
    const users = rows.length > limit ? rows.slice(0, limit): rows;

    if (!users.length) throw new UserNotFoundError();
    const nextCursor = rows.length > limit ? users.at(-1)!.id : null;

    return { users, nextCursor };
  }

  public async update(
    userId: string,
    data: Partial<UserDeclaredFields> & Partial<IdentityProof>,
  ): Promise<UserClientSafeType> {
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
        data: updateData,
        omit: {
          password: true,
          deletedAt: true,
        },
      });

      return updatedUser;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UserConflictError();
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UserNotFoundError();
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
  ): Promise<UserClientSafeType & { deletedAt: Date | null }> {
    await this.requireCurrentPassword(userId, currentPassword);

    try {
      return await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          deletedAt: new Date(),
        },
        omit: {
          password: true,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UserNotFoundError();
      }

      throw error;
    }
  }
}
