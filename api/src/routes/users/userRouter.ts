import { compare, hash } from 'bcrypt';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/prevalidation.js';
import { handleDBError } from '../../utils/handleDBConflict.js';
import type { BadRequest, NotFoundResponse, UnauthorizedResponse } from '../../types/typebox/responses.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUserSchema,
  PublicProfileSchema,
  ReadUserSchema,
} from './userSchemas.js';

const ROUNDS = 10;

const zxcvbn = new ZxcvbnFactory({
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  translations: zxcvbnEnPackage.translations,
});

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
        timeWindow: '1 day',
        keyGenerator: (req) => `registration:${req.ip}`,
      },
    },
  }, async (req, res) => {
    const passwordCheck = zxcvbn.check(req.body.password);

    if (passwordCheck.score < 3) {
      return res.code(400).send({
        error: 'BadRequest',
        message: 'Password too weak',
        suggestions: passwordCheck.feedback.suggestions,
      } satisfies Static<typeof BadRequest>);
    }
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
    const user = await app.prisma.user.findUnique({
      where: {
        id: req.user!.id,
        deletedAt: null,
      },
      omit: {
        password: true,
        deletedAt: true,
      },
    });

    if (!user) {
      return res.code(404).send({
        error: 'NotFound',
        message: 'Your user cannot be found',
      } satisfies Static<typeof NotFoundResponse>);
    }

    return res.send(user);
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
      const passwordCheck = zxcvbn.check(updateData.password);

      if (passwordCheck.score < 3) {
        return res.code(400).send({
          error: 'BadRequest',
          message: 'Password too weak',
          suggestions: passwordCheck.feedback.suggestions,
        } satisfies Static<typeof BadRequest>);
      }

      updateData.password = await hash(updateData.password, ROUNDS);
    }

    try {
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

      if (req.body.role) {
        await req.logIn(updatedUser);
      }

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
