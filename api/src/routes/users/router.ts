import { zxcvbn } from 'zxcvbn-ts';
import { compare, hash } from 'bcrypt';
import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { UserWhereInput, UserFindManyArgs } from '../../db/models.js';
import { assertIsLoggedIn, isLoggedIn } from '../../auth/preHandler.js';
import { extractConflictColumns, handleDBConflict } from '../../error/database.js';
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
const MAX_USERNAME_RETRIES = 100;

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
    if (!req.body.role) req.body.role = 'AUTOBIOGRAPHER';
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

    if (req.body.username) {
      try {
        return await createUser(req.body.username);
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError) {
          return handleDBConflict(error, res);
        }
        throw error;
      }
    }

    /**
     * Attempt to create a user with a forename-surname username to minimize
     * sign-up friction. If another username already exists with that username,
     * retry with an incrementing suffix. Retry-on-conflict rather than pre-check
     * availability to defend against TOCTOU race conditions with async requests.
     */
    const baseUsername = `${req.body.forename}-${req.body.surname}`;

    for (let attempt = 0; attempt < MAX_USERNAME_RETRIES; attempt++) {
      const username = attempt === 0 ? baseUsername : `${baseUsername}-${attempt}`;

      try {
        return await createUser(username);
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          if (extractConflictColumns(error.meta).includes('username')) {
            if (attempt < MAX_USERNAME_RETRIES - 1) {
              continue;
            } else {
              throw error;
            };
          } else {
            return handleDBConflict(error, res);
          }
        }

        throw error;
      }
    }
  });

  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetSelfSchema,
  }, async (req, res) => {
    try {
      assertIsLoggedIn(req);
  
      const { followers, following, ...user } = await app.prisma.user.findUniqueOrThrow({
        where: {
          id: req.user.id,
          deletedAt: null,
        },
        omit: {
          password: true,
          deletedAt: true,
        },
        include: {
          followers: { select: { followerId: true } },
          following: { select: { followingId: true } },
        },
      });

      return res.code(200).send({
        ...user,
        followers: followers.map(f => f.followerId),
        following: following.map(f => f.followingId),
      });
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
      const { name, role, cursor, limit = 20 } = req.query;
      const terms = name.trim().split(/\s+/);

      const where: UserWhereInput = {
        deletedAt: null,
        AND: terms.map(term => ({
          OR: [
            { forename: { contains: term, mode: 'insensitive' } },
            { surname: { contains: term, mode: 'insensitive' } },
            { username: { contains: term, mode: 'insensitive' } },
          ],
        })),
      };

      if (role) {
        where.role = role;
      }

      const findManyArgs: UserFindManyArgs = {
        where,
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
        return res.code(404).send({
          error: 'NotFound',
          message: `No users found matching '${name}'`,
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

    try {
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
            message: 'Provide your password to update these credentials',
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
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        handleDBConflict(error, res);
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
