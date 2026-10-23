import { Type } from '@sinclair/typebox';
import { CUID, Slug, Title, TagInput, Hook } from '@/typebox/inputs.js';
import {
  Conflict,
  meErrorResponses,
  NotFound,
  UnprocessableEntity,
} from '@/typebox/responses.js';
import { security } from '@/typebox/constants.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '@/typebox/mapping.js';
import type { PrePublishDefaults, PublishSnapshot } from '@/services/posts/PublishService.js';

const tags = ['Draft', 'Publish'];
const params = Type.Object({ id: CUID });

export const PublishDraft = {
  summary: 'Publish draft',
  description: 'Make your draft publicly discoverable',
  security,
  tags,
  params,
  body: Type.Object({
    slug: Slug,
    publishedTitle: Title,
    publishedHook: Hook,
    coverImageId: CUID,
    tags: Type.Array(TagInput, { maxItems: 10 }),
  } satisfies TypeBoxModel<PublishSnapshot>, { additionalProperties: false }),
  response: {
    204: Type.Null(),
    409: Conflict,
    422: UnprocessableEntity,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const Prepublish = {
  summary: 'Prepublish',
  description: 'Get reasonable defaults for publish data to reduce user friction',
  security,
  tags,
  params,
  response: {
    200: Type.Object({
      slug: Type.String(),
      publishedTitle: Type.String(),
      publishedHook: Type.String(),
      coverImageId: Type.Union([Type.String(), Type.Null()]),
      coverImageKey: Type.Union([Type.String(), Type.Null()]),
    } satisfies TypeBoxModel<PrePublishDefaults>, { additionalProperties: false }),
    404: NotFound,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const Unpublish = {
  summary: 'Unpublish',
  description: 'Make a published accessible only to its editors again',
  security,
  tags,
  params,
  response: {
    204: Type.Null(),
    ...meErrorResponses,
  },
} satisfies FastifySchema;
