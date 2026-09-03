import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';

export const CreatePostSchema = {
  body: Type.Object({
    title: Type.String(),
  }),
  response: {
    201: Type.Object({
      id: Type.String(),
    }),
  },
} satisfies FastifySchema;
