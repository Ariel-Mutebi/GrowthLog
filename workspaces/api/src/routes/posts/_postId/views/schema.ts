import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import { CUID } from '@/typebox/inputs.js';
import { security } from '@/typebox/constants.js';
import { meErrorResponses } from '@/typebox/responses.js';

export const View = {
  summary: 'Save view',
  description: 'Record when a user opens or finishes a post',
  tags: ['Post', 'Views'],
  security,
  params: Type.Object({
    postId: CUID,
  }),
  body: Type.Object({
    type: Type.Union([
      Type.Literal('OPENED'),
      Type.Literal('READ'),
    ]),
  }),
  response: {
    204: Type.Null(),
    ...meErrorResponses,
  },
} satisfies FastifySchema;
