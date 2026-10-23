import { PrismaClientKnownRequestError } from '@growthlog/db';
import { escapeLike } from '@/utils/sanitize.js';
import { UserNotFoundError } from './shared/errors.js';
import { publicSelect } from './shared/selectors.js';
import { flattenAvatarKey } from './shared/helpers.js';

import type {
  PrismaClient,
  UserWhereInput,
  UserFindManyArgs,
} from '@growthlog/db';
import type { PublicUser, SearchParams, SearchResult } from './shared/interfaces.js';

export class DiscoveryService {
  constructor(private readonly prisma: PrismaClient) {}

  public async getUser(id: string): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: {
          id,
          deletedAt: null,
        },
        select: publicSelect,
      });
      return flattenAvatarKey(user);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UserNotFoundError();
      }
      throw error;
    }
  }

  public async paginatedSearch(params: Partial<SearchParams>): Promise<SearchResult> {
    const { name, interests, cursor, limit = 20 } = params;
    if (!name && !interests) throw new UserNotFoundError();

    const filters: UserWhereInput[] = [];

    if (name) {
      const terms = name.trim().split(/\s+/).map(escapeLike);
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };

    if (cursor) {
      findManyArgs.cursor = { id: cursor };
      findManyArgs.skip = 1;
    }

    const rows = await this.prisma.user.findMany({
      ...findManyArgs,
      select: publicSelect,
    });

    const flat = rows.map(user => flattenAvatarKey(user));
    const users = flat.length > limit ? flat.slice(0, limit): flat;

    if (!users.length) throw new UserNotFoundError();
    const nextCursor = flat.length > limit ? users.at(-1)!.id : null;

    return { users, nextCursor };
  }
}
