import { Type } from '@sinclair/typebox';
import { TagInput } from '@/typebox/inputs.js';
import { generalErrorResponses } from '@/typebox/responses.js';

import type { FastifySchema } from 'fastify';
import type { TypeBoxModel } from '@/typebox/mapping.js';
import type { TagSuggestion } from '@/services/TagService.js';

const TagSuggestionObject = Type.Object({
  id: Type.String(),
  name: Type.String(),
  postCount: Type.Number(),
} satisfies TypeBoxModel<TagSuggestion>);

export const TagSearch = {
  summary: 'Tag search',
  description: 'Get the tags which match the search string, with their number of posts',
  tags: ['Tags'],
  body: Type.Object({
    search: TagInput,
  }),
  response: {
    200: Type.Array(TagSuggestionObject),
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
