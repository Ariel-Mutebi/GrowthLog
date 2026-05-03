import type { FastifyReply } from 'fastify';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import type { Static } from '@sinclair/typebox';
import type { ConflictResponse } from './userSchemas.js';

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function handleDBConflict(error: unknown, res: FastifyReply) {
  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
    const columns = error.meta?.target as string[];

    const message = columns.length > 1
      ? `${listFormatter.format(columns)} are already in use`
      : `${columns[0]} is already in use`;

    return res.code(409).send({
      error: 'Conflict',
      message,
    } satisfies Static<typeof ConflictResponse>);
  }

  throw error;
}
