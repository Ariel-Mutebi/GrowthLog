import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';

export const FollowSomeone = {
  summary: 'Follow',
  description: 'The caller followers the user with the given userId; done idempotently',
  tags: ['Users', 'Followers'],
  security: [{ session: [] }],
  params: Type.Object({
    userId: Type.String(),
  }),
  response: {
    204: Type.Null(),
  },
} satisfies FastifySchema;
