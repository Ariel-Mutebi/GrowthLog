import type { FastifySchema } from 'fastify';
import { Type } from '@sinclair/typebox';
import { security } from '../../typebox/constants.js';
import { PersonalObject } from '../../typebox/users.js';
import { EditableFields, IdentityObject } from '../../typebox/users.js';
import { BadRequest, Conflict, Forbidden, meErrorResponses } from '../../typebox/responses.js';

const tags = ['Users', 'Me'];

export const GetSelf = {
  summary: 'Get Self',
  description: 'Get your account details',
  security,
  tags,
  response: {
    200: PersonalObject,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const UpdateSelf = {
  summary: 'Update self',
  description: 'Update your editable account details (passwordAttempt required to edit email or password)',
  security,
  tags,
  body: Type.Composite([
    Type.Partial(IdentityObject),
    Type.Partial(EditableFields),
  ], { additionalProperties: false }),
  response: {
    200: PersonalObject,
    400: BadRequest,
    403: Forbidden,
    409: Conflict,
    ...meErrorResponses,
  },
} satisfies FastifySchema;

export const DeleteSelf = {
  summary: 'Delete self',
  description: 'Soft deletes your account, which can be recovered by logging in within 7 days',
  tags,
  body: IdentityObject,
  response: {
    204: Type.Null(),
    403: Forbidden,
    ...meErrorResponses,
  },
} satisfies FastifySchema;
