import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { RateLimitedResponse } from '../../typebox/responses.js';

export const GetCollabToken = {
  summary: 'Collaboration',
  description:'Get a JWT to authenticate the document-editing microservice',
  security: [{ session: [] }],
  response: {
    200: Type.String(),
    429: RateLimitedResponse,
  },
} satisfies FastifySchema;
