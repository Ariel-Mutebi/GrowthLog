import { compare, hash } from 'bcrypt';
import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/preHandler.js';
import { handleDBError } from '../../utils/database.js';
import type { NotFoundResponse, UnauthorizedResponse } from '../../types/typebox/responses.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUserSchema,
  GetUserSchema,
  GetSelfSchema,
  UserSearchSchema,
} from './userSchemas.js';
import { rejectWeakPassword } from '../../utils/password.js';

const ROUNDS = 10;

const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: CreateUserSchema,
    /**
     * spam protection: one IP address can only create one user per day.
     * also protects against enumeration attacks where an attacker could
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
    
    try {
      const user = await app.prisma.user.create({
        data: req.body,
        omit: {
          password: true,
          deletedAt: true,
        },
      });
      await req.logIn(user);
      return res.status(201).send(user);
    } catch (error) {
      return handleDBError(error, res);
    }
  });

  app.get('/', {
    preHandler: isLoggedIn,
    schema: GetSelfSchema,
  }, async (req, res) => {
    try {
      const { followers, following, ...user } = await app.prisma.user.findUniqueOrThrow({
        where: {
          id: req.user!.id,
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
      return handleDBError(error, res);
    }
  });

  app.get('/:userId', {
    preHandler: isLoggedIn,
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

  app.get('/', {
    preHandler: isLoggedIn,
    schema: UserSearchSchema,
  }, async (req, res) => {
      const { name, role } = req.query;
      const terms = name.trim().split(/\s+/);

      const users = await app.prisma.user.findMany({
        where: {
          deletedAt: null,
          ...(role && { role }),
          AND: terms.map(term => ({
            OR: [
              { forename: { contains: term, mode: 'insensitive' } },
              { surname: { contains: term, mode: 'insensitive' } },
              { username: { contains: term, mode: 'insensitive' } },
            ],
          })),
        },
        omit: {
          email: true,
          password: true,
          deletedAt: true,
        },
      });

      if (!users.length) {
        return res.code(404).send({
          error: 'NotFound',
          message: `No users found matching '${name}'`,
        } satisfies Static<typeof NotFoundResponse>);
      }

      return res.send(users);
    });

  app.patch('/', {
    preHandler: isLoggedIn,
    schema: UpdateUserSchema,
  }, async (req, res) => {
    try {
      const { currentPassword, ...updateData } = req.body;

      if (updateData.email || updateData.password) {
        const { password } = await app.prisma.user.findUniqueOrThrow({
          where: {
            id: req.user!.id,
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
          id: req.user!.id,
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
      return handleDBError(error, res); 
    }
  });

  app.delete('/', {
    preHandler: isLoggedIn,
    schema: DeleteUserSchema,
  }, async (req, res) => {
    try {
      const { password } = await app.prisma.user.findUniqueOrThrow({
        where: {
          id: req.user!.id,
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
          id: req.user!.id,
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
    } catch (error) {
      return handleDBError(error, res);
    }
  });
};

export default userRouter;
