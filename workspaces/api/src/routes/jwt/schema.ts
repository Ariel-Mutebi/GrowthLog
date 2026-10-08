import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { RateLimited } from '../../typebox/responses.js';

export const GetJWTSchema = {
  summary: 'JWT',
  description:'Get a JWT to authenticate other microservices (document-editing, image processing)',
  tags: ['Microservices'],
  security: [{ session: [] }],
  response: {
    200: Type.Object({
      token: Type.String(),
    }),
    429: RateLimited,
  },
} satisfies FastifySchema;
