import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { Email } from '../../types/typebox.js';

export const CreateSessionSchema = {
  body: Type.Object({
    email: Email,
    password: Type.String(),
  }),
} satisfies FastifySchema;
