import { hash } from 'bcrypt';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/isLoggedIn.js';
import { handleDBConflict } from '../../utils/handleDBConflict.js';
import { CreateUserSchema, SuccessfulResponse, UpdateUserSchema } from './userSchemas.js';
import type { NonModeratorUser } from '../../types/generic.js';

const ROUNDS = 10;

const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: CreateUserSchema,
  }, async (req, res) => {
    req.body.password = await hash(req.body.password, ROUNDS);
    
    try {
      const user = await app.prisma.user.create({ data: req.body }) as NonModeratorUser;
      await req.logIn(user);
      return res.send(user);
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
      }) as NonModeratorUser;

      if (req.body.role) {
        req.logIn(updatedUser);
      }

      return res.send(updatedUser);
    } catch (error) {
      handleDBConflict(error, res); 
    }
  });

  app.delete('/', {
    preValidation: isLoggedIn(app.auth),
    schema: {
      response: {
        200: SuccessfulResponse,
      },
    },
  }, async (req, res) => {
    const softDeletedUser = await app.prisma.user.update({
      where: {
        id: req.user?.id,
      },
      data: {
        deletedAt: new Date(),
      },
    }) as NonModeratorUser;

    await req.logOut();
    return res.send(softDeletedUser);
  });
};

export default userRouter;
