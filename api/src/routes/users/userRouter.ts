import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateUserBody, ConflictResponse } from './userSchemas.js';
import { hash } from 'bcrypt';
import { Type } from '@sinclair/typebox';
import { isLoggedIn } from '../../auth/isLoggedIn.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export const userRouter: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/', {
    schema: {
      body: CreateUserBody,
      response: {
        204: Type.Void(),
        409: ConflictResponse,
      },
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
    
    try {
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
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const columns = error.meta?.target as string[];

        const listFormatter = new Intl.ListFormat('en', {
          style: 'long',
          type: 'conjunction',
        });

        const message = columns.length > 1 ?
          `${listFormatter.format(columns)} are already in use` :
          `${columns[0]} is already in use`;

        return res.code(409).send({
          error: 'Conflict',
          message,
        });
      }
      throw error;
    }
  });

  app.patch('/', {
    preValidation: isLoggedIn(app.auth),
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
