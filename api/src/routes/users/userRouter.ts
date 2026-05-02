import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateUserBody } from './userSchemas.js';
import { hash } from 'bcrypt';
import { Type } from '@sinclair/typebox';
import type { preValidationHookHandler } from 'fastify';

export const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: {
      body: CreateUserBody,
    },
  }, async (req, res) => {
    const {
      forename,
      surname,
      username,
      email,
      role,
      password,
    } = req.body;

    const hashedPassword = await hash(password, 10);
    
    const user = await app.prisma.user.create({
      data: {
        forename,
        surname,
        username,
        email,
        role,
        password: hashedPassword,
      },
    });

    await req.logIn(user);
    return res.code(204).send();
  });

  app.patch('/', {
    preValidation: app.auth.authenticate('session') as preValidationHookHandler,
    schema: {
      body: Type.Partial(CreateUserBody),
    },
  }, async (req, res) => {
    await app.prisma.user.update({
      where: {
        id: req.user?.id,
      },
      data: req.body,
    });
    return res.code(204).send();
  });
};
