import { Type } from '@sinclair/typebox';
import { meErrorResponses } from '../../../typebox/responses.js';
import { security } from '../../../typebox/constants.js';
import { OptionalDate, SerializableDate } from '../../../typebox/date.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '../../../typebox/mapping.js';
import type { DraftMetadata } from '../../../services/posts/DraftService.js';

export const DraftMetadataObject = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  createdAt: SerializableDate,
  updatedAt: SerializableDate,
  publishedAt: OptionalDate,
} satisfies TypeBoxModel<DraftMetadata>);

const tags = ['Drafts'];

export const CreateDraft = {
  summary: 'Create draft',
  description: 'Creates an untitled draft',
  security,
  tags,
  response: {
    201: DraftMetadataObject,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

const GetDraftsQuery = Type.Partial(Type.Object({
  sortBy: Type.Union([
    Type.Literal('title'),
    Type.Literal('updatedAt'),
  ]),
  order: Type.Union([
    Type.Literal('asc'),
    Type.Literal('desc'),
  ]),
  published: Type.Boolean(),
}));

export const GetDrafts = {
  summary: 'Get drafts',
  description: 'Get your drafts, filtered and sorted',
  security,
  tags,
  querystring: GetDraftsQuery,
  response: {
    200: Type.Array(DraftMetadataObject),
    ...meErrorResponses,
  },
} satisfies FastifySchema;
