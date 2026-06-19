import type { FastifyReply } from 'fastify';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import type { Static } from '@sinclair/typebox';
import type { ConflictResponse, NotFoundResponse } from '../types/typebox/responses.js';

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/**
 * Maps known Prisma errors to API responses. Unmapped errors are rethrown.
 */
export function handleDBError(error: unknown, res: FastifyReply) {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      // Unique constraint violation
      case 'P2002': {
        const columns = (error.meta?.target as string[] | undefined) ?? [];

        if (columns.length > 1) {
          return res.code(409).send({
            error: 'Conflict',
            message: `${listFormatter.format(columns)} are already in use`,
          } satisfies Static<typeof ConflictResponse>);
        } else if (columns.length > 0) {
          const [column] = columns;
          return res.code(409).send({
            error: 'Conflict',
            message: `${column} is already in use`,
          } satisfies Static<typeof ConflictResponse>);  
        }

        break;
      }

      // Record required by the operation was not found
      case 'P2025': {
        return res.code(404).send({
          error: 'NotFound',
          message: 'The requested record was not found',
        } satisfies Static<typeof NotFoundResponse>);
      }

      default:
        break;
    }
  }

  throw error;
}
