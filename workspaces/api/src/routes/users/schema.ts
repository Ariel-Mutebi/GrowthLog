import { Type } from '@sinclair/typebox';
import type { FastifySchema } from 'fastify';
import {
  BadRequest,
  Conflict,
  NotFound,
  Unauthorized,
  generalErrorResponses,
} from '@/typebox/responses.js';
import { CUID } from '@/typebox/inputs.js';
import { TagInput } from '@/typebox/inputs.js';
import { EditableFields, PersonalObject, PublicUserObject } from '@/typebox/users.js';

export const Register = {
  summary: 'Register',
  description: 'Creates a user account and opens a session. One request per IP per day.',
  tags: ['Users'],
  body: EditableFields,
  response: {
    201: PersonalObject,
    400: BadRequest,
    409: Conflict,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const GetUser = {
  summary: 'Get User',
  description: 'Get basic public data about a user\'s account',
  tags: ['Users'],
  params: Type.Object({
    id: CUID,
  }),
  response: {
    200: PublicUserObject,
    401: Unauthorized,
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;

export const UserSearch = {
  summary: 'User Search',
  description: 'Search for users by name and/or interests (tags on their published posts)',
  tags: ['Users'],
  querystring: Type.Partial(Type.Object(
    {
      name: Type.String({ minLength: 1, maxLength: 50, pattern: '\\S' }),
      interests: Type.Array(TagInput),
      cursor: Type.String(),
      limit: Type.Integer({ minimum: 1, maximum: 50, default: 20 }),
    },
    // at least one of name / interest must be present
    { anyOf: [{ required: ['name'] }, { required: ['interests'] }] },
  )),
  response: {
    200: Type.Object({
      users: Type.Array(PublicUserObject),
      nextCursor: Type.Union([Type.String(), Type.Null()]),
    }),
    404: NotFound,
    ...generalErrorResponses,
  },
} satisfies FastifySchema;
