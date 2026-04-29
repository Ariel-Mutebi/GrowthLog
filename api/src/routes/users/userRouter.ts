import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateUserBody } from './userSchemas.js';
import { hash } from 'bcrypt';

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
      password,
    } = req.body;

    const hashedPassword = await hash(password, 10);
    
    const user = await app.prisma.user.create({
      data: {
        forename,
        surname,
        username,
        email,
        password: hashedPassword,
      },
    });

    await req.logIn(user);
    return res.code(204).send();
  });
};
