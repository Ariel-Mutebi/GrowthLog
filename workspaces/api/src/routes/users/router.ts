import { zxcvbn } from 'zxcvbn-ts';
import { compare, hash } from 'bcrypt';
import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { UserWhereInput, UserFindManyArgs } from '@growthlog/db';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { doOrHandleDBConflict, attemptWithConflictRetry } from '../../error/database.js';
import type { NotFoundResponse, UnauthorizedResponse } from '../../typebox/responses.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUserSchema,
  GetUserSchema,
  GetSelfSchema,
  UserSearchSchema,
} from './schema.js';
import type { FastifyReply } from 'fastify';
import type { BadRequest } from '../../typebox/responses.js';

function rejectWeakPassword(password: string, res: FastifyReply): boolean {
  const { score, feedback } = zxcvbn(password);

  if (score < 3) {
    res.code(400).send({
      error: 'BadRequest',
      message: 'Password too weak',
      suggestions: feedback.suggestions as string[],
    } satisfies Static<typeof BadRequest>);
    return true;
  }

  return false;
}

const ROUNDS = 10;

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: CreateUserSchema,
    /**
     * spam protection: one IP address can only create one user per day.
     * Also protects against enumeration attacks where an attacker could
     * try to see which credentials cause database conflicts.
     */
    config: {
      rateLimit: {
        max: 1,
        timeWindow: 24 * 3600 * 1000,
        keyGenerator: (req) => `registration:${req.ip}`,
      },
    },
  }, async (req, res) => {
    if (rejectWeakPassword(req.body.password, res)) return;
    req.body.password = await hash(req.body.password, ROUNDS);

    const createUser = async (username: string) => {
      const user = await app.prisma.user.create({
        data: { ...req.body, username },
        omit: {
          password: true,
          deletedAt: true,
        },
      });

      await req.logIn(user);
      return res.status(201).send(user);
    };

    const { username } = req.body;

    if (username) {
      return doOrHandleDBConflict(() => createUser(username), res);
    }

    return attemptWithConflictRetry({
      res,
      attempt: createUser,
      conflictColumn: 'username',
      base: `${req.body.forename}-${req.body.surname}`,
    });
  });

  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetSelfSchema,
  }, async (req, res) => {
    try {
      assertIsLoggedIn(req);
  
      const user = await app.prisma.user.findUniqueOrThrow({
        where: {
          id: req.user.id,
          deletedAt: null,
        },
        omit: {
          password: true,
          deletedAt: true,
        },
      });

      return res.code(200).send(user);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The requested user was not found',
        });
      }

      throw error;
    }
  });

  app.get('/search', {
    schema: UserSearchSchema,
  }, async (req, res) => {
    const { name, interest, cursor, limit = 20 } = req.query;

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

    if (interest) {
      // Public interests come only from what a user has published
      filters.push({
        posts: {
          some: {
            publishedAt: { not: null },
            deletedAt: null,
            tags: {
              some: { name: { equals: interest.trim(), mode: 'insensitive' } },
            },
          },
        },
      });
    }

    const findManyArgs: UserFindManyArgs = {
      where: { deletedAt: null, AND: filters },
      orderBy: { createdAt: 'asc' },
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

    const rows = await app.prisma.user.findMany(findManyArgs);
    const hasMore = rows.length > limit;
    const users = hasMore ? rows.slice(0, limit) : rows;

    if (!users.length) {
      const criteria = [
        name && `name '${name}'`,
        interest && `interest '${interest}'`,
      ].filter(Boolean).join(' and ');

      return res.code(404).send({
        error: 'NotFound',
        message: `No users found matching ${criteria}`,
      } satisfies Static<typeof NotFoundResponse>);
    }

    return res.send({
      users,
      nextCursor: hasMore ? users.at(-1)!.id : null,
    });
  });

  app.get('/:userId', {
    schema: GetUserSchema,
  }, async (req, res) => {
    const foundUser = await app.prisma.user.findUnique({
      where: {
        id: req.params.userId,
        deletedAt: null,
      },
      omit: {
        email: true,
        password: true,
        deletedAt: true,
      },
    });

    if (!foundUser) {
      return res.code(404).send({
        error: 'NotFound',
        message: `User with the id ${req.params.userId} not found`,
      } satisfies Static<typeof NotFoundResponse>);
    }

    return res.send(foundUser);
  });

  app.patch('/', {
    preHandler: isLoggedIn,
    schema: UpdateUserSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const updateUser = async () => {
      const { currentPassword, ...updateData } = req.body;

      if (updateData.email || updateData.password) {
        const { password } = await app.prisma.user.findUniqueOrThrow({
          where: {
            id: req.user.id,
          },
          select: {
            password: true,
          },
        });

        if (!currentPassword || !(await compare(currentPassword, password))) {
          return res.code(401).send({
            error: 'Unauthorized',
            message: 'Provide the correct password to update these credentials',
          } satisfies Static<typeof UnauthorizedResponse>);
        }
      }

      if (updateData.password) {
        if (rejectWeakPassword(updateData.password, res)) return;
        updateData.password = await hash(updateData.password, ROUNDS);
      }

      const updatedUser = await app.prisma.user.update({
        where: {
          id: req.user.id,
          deletedAt: null,
        },
        data: updateData,
        omit: {
          password: true,
          deletedAt: true,
        },
      });

      return res.send(updatedUser);
    };

    try {
      return await doOrHandleDBConflict(updateUser, res);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.code(404).send({
          error: 'NotFound',
          message: 'This user cannot be found. The account may have been deleted',
        });
      }

      throw error;
    }
  });

  app.delete('/', {
    preHandler: isLoggedIn,
    schema: DeleteUserSchema,
  }, async (req, res) => {
    assertIsLoggedIn(req);

    const { password } = await app.prisma.user.findUniqueOrThrow({
      where: {
        id: req.user.id,
      },
      select: {
        password: true,
      },
    });

    if (!(await compare(req.body.currentPassword, password))) {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'Provide the correct password to delete your account',
      } satisfies Static<typeof UnauthorizedResponse>);
    }

    const softDeletedUser = await app.prisma.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        deletedAt: new Date(),
      },
      omit: {
        password: true,
        deletedAt: true,
      },
    });

    await req.logOut();
    await req.session.destroy();
    res.clearCookie('sessionId');
    return res.send(softDeletedUser);
  });
};

export default router;
