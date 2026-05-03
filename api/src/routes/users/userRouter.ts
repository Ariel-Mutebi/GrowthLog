import { hash } from 'bcrypt';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/isLoggedIn.js';
import { handleDBConflict } from './handleDBConflict.js';
import { CreateUserSchema, UpdateUserSchema } from './userSchemas.js';

const ROUNDS = 10;

export const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: CreateUserSchema,
  }, async (req, res) => {
    req.body.password = await hash(req.body.password, ROUNDS);
    
    try {
      const user = await app.prisma.user.create({ data: req.body });
      await req.logIn(user);
      return res.code(204).send();
    } catch (error) {
      handleDBConflict(error, res);
    }
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
          id: req.user?.id,
        },
        data: req.body,
      });

      if (req.body.role) {
        req.logIn(updatedUser);
      }

      return res.code(204).send();
    } catch (error) {
      handleDBConflict(error, res); 
    }
  });

  app.delete('/', {
    preValidation: isLoggedIn(app.auth),
  }, async (req, res) => {
    await app.prisma.user.update({
      where: {
        id: req.user?.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    await req.logOut();
    return res.code(204).send();
  });
};
