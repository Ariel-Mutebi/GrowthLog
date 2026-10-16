import { Type } from '@sinclair/typebox';
import {
  Conflict,
  meErrorResponses,
  NotFound,
  Unauthorized,
  UnprocessableEntity,
} from '../../../../typebox/responses.js';
import { security } from '../../../../typebox/constants.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '../../../../typebox/mapping.js';
import type { PrePublishDefaults, PublishSnapshot } from '../../../../services/posts/PublishService.js';

const tags = ['Me', 'Drafts', 'Publish'];

export const PublishDraft = {
  summary: 'Publish draft',
  description: 'Make your draft publicly discoverable',
  security,
  tags,
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Object({
    slug: Type.String(),
    publishedTitle: Type.String(),
    publishedHook: Type.String(),
    coverImageId: Type.String(),
  } satisfies TypeBoxModel<PublishSnapshot>),
  response: {
    204: Type.Null(),
    400: NotFound,
    404: Unauthorized,
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
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    200: Type.Object({
      slug: Type.String(),
      publishedTitle: Type.String(),
      publishedHook: Type.String(),
      coverImageId: Type.Union([Type.String(), Type.Null()]),
      coverImageKey: Type.Union([Type.String(), Type.Null()]),
    } satisfies TypeBoxModel<PrePublishDefaults>),
    404: NotFound,
    ...meErrorResponses,
  },
} satisfies FastifySchema;
