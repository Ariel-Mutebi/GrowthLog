import { Type } from '@sinclair/typebox';
import {
  BadRequest,
  Conflict,
  meErrorResponses,
  NotFound,
} from '../../../typebox/responses.js';
import { security } from '../../../typebox/constants.js';
import { OptionalDate, SerializableDate } from '../../../typebox/date.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '../../../typebox/mapping.js';
import type { DraftMetadata } from '../../../services/posts/DraftService.js';

const DraftMetadataObject = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  createdAt: SerializableDate,
  updatedAt: SerializableDate,
  publishedAt: OptionalDate,
} satisfies TypeBoxModel<DraftMetadata>);

const tags = ['Me', 'Drafts'];

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
