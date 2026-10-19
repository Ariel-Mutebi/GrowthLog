import { Type } from '@sinclair/typebox';
import {
  BadRequest,
  Conflict,
  meErrorResponses,
  NotFound,
} from '@/typebox/responses.js';
import { security } from '@/typebox/constants.js';

import type { FastifySchema } from 'fastify';
import { DraftMetadataObject } from '../schema.js';

const tags = ['Me', 'Draft'];

export const UpdateDraft = {
  summary: 'Update draft',
  description: 'Update your draft\'s title',
  security,
  tags,
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Object({
    title: Type.String({ minLength: 1, maxLength: 20 }),
  }),
  response: {
    200: DraftMetadataObject,
    400: BadRequest,
    404: NotFound,
    409: Conflict,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const GetDraft = {
  summary: 'Get draft',
  description: 'Get authoring metadata about your draft',
  security,
  tags,
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: DraftMetadataObject,
    404: NotFound,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const DeleteDraft = {
  summary: 'Delete draft',
  description: 'Soft-deletes a draft',
  security,
  tags,
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    204: Type.Null(),
    ...meErrorResponses,
  },
} satisfies FastifySchema;
