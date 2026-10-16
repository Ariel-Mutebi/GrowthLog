import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { security } from '../../../typebox/constants.js';
import { RateLimited } from '../../../typebox/responses.js';

export const Handoff = {
  summary: 'Hand-off',
  description:'Get a JWT to authenticate other microservices',
  tags: ['Microservices'],
  security,
  response: {
    200: Type.Object({
      token: Type.String(),
    }),
    429: RateLimited,
  },
} satisfies FastifySchema;
