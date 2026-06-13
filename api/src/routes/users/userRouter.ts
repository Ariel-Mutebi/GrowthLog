import { hash } from 'bcrypt';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/prevalidation.js';
import { handleDBError } from '../../utils/handleDBConflict.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ReadOrDeleteUserSchema,
  PublicProfileSchema,
} from './userSchemas.js';

const ROUNDS = 10;

const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: CreateUserSchema,
  }, async (req, res) => {
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
    schema: ReadOrDeleteUserSchema,
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
      });
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
      });
    }

    return res.send(otherUser);
  });

  app.patch('/', {
    preValidation: isLoggedIn(app.auth),
    schema: UpdateUserSchema,
  }, async (req, res) => {
    if (req.body.password) {
      req.body.password = await hash(req.body.password, ROUNDS);
    }

    try {
      const updatedUser = await app.prisma.user.update({
        where: {
          id: req.user!.id,
          deletedAt: null,
        },
        data: req.body,
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
    schema: ReadOrDeleteUserSchema,
  }, async (req, res) => {
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
    return res.send(softDeletedUser);
  });
};

export default userRouter;
