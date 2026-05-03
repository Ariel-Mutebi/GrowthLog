import { hash } from 'bcrypt';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { isLoggedIn } from '../../auth/isLoggedIn.js';
import { handleDBConflict } from './handleDBConflict.js';
import { CreateUserSchema, UpdateUserSchema } from './userSchemas.js';

export const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: CreateUserSchema,
  }, async (req, res) => {
    const { password, ...rest } = req.body;
    const hashedPassword = await hash(password, 10);
    
    try {
      const user = await app.prisma.user.create({ data: { ...rest, password: hashedPassword } });
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
    try {
      const updatedUser = await app.prisma.user.update({
        where: {
          id: req.user?.id,
        },
        data: req.body,
      });

      // Update session store if role is updated.
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
