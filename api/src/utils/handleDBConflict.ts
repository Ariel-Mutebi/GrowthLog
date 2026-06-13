import type { FastifyReply } from 'fastify';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import type { Static } from '@sinclair/typebox';
import type { ConflictResponse, NotFoundResponse } from '../routes/users/userSchemas.js';

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function handleDBError(error: unknown, res: FastifyReply) {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const columns = error.meta?.target as string[];

        const message = columns.length > 1
          ? `${listFormatter.format(columns)} are already in use`
          : `${columns[0]} is already in use`;

        return res.code(409).send({
          error: 'Conflict',
          message,
        } satisfies Static<typeof ConflictResponse>);
      }
    
      case 'P2025': {
        return res.code(404).send({
          error: 'NotFound',
          message: error.meta?.cause as string,
        } satisfies Static<typeof NotFoundResponse>);
      }

      default:
        break;
    }
  }

  throw error;
}
