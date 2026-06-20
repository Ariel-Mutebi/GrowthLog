import { compare, hash } from 'bcrypt';
import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/prevalidation.js';
import { handleDBError } from '../../utils/database.js';
import type { NotFoundResponse, UnauthorizedResponse } from '../../types/typebox/responses.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUserSchema,
  PublicProfileSchema,
  ReadUserSchema,
} from './userSchemas.js';
import { rejectWeakPassword } from '../../utils/password.js';
import { redisKey } from '../../utils/redis.js';

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
        keyGenerator: (req) => redisKey(`registration:${req.ip}`),
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
      return res.send(user);
    } catch (error) {
      return handleDBError(error, res);
    }
  });

  app.get('/', {
    preValidation: isLoggedIn(app.auth),
    schema: ReadUserSchema,
  }, async (req, res) => {
    try {
      const user = await app.prisma.user.findUniqueOrThrow({
        where: {
          id: req.user!.id,
          deletedAt: null,
        },
        omit: {
          password: true,
          deletedAt: true,
        },
      });

      return res.send(user);
    } catch (error) {
      // 99% unreachable: deserializeUser already guarantees live user.
      return handleDBError(error, res);
    }
  });

  // access another user's public profile
  app.get('/:userId', {
    preValidation: isLoggedIn(app.auth),
    schema: PublicProfileSchema,
  }, async (req, res) => {
    const otherUser = await app.prisma.user.findUnique({
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

    if (!otherUser) {
      return res.code(404).send({
        error: 'NotFound',
        message: `User with the id ${req.params.userId} not found`,
      } satisfies Static<typeof NotFoundResponse>);
    }

    return res.send(otherUser);
  });

  app.patch('/', {
    preValidation: isLoggedIn(app.auth),
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
    preValidation: isLoggedIn(app.auth),
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
