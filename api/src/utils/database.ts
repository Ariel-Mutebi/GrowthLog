import type { FastifyReply } from 'fastify';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Static } from '@sinclair/typebox';
import type { ConflictResponse, NotFoundResponse } from '../types/typebox/responses.js';

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

type ColumnExtractor = (meta: Record<string, unknown>) => string[];

/**
 * Reads conflict columns from Prisma's meta.target (standard client).
 */
const extractFromTarget: ColumnExtractor = (meta) =>
  (meta.target as string[] | undefined) ?? [];

/**
 * Reads conflict columns from the driver adapter error (adapter-pg path).
 * meta.target is unpopulated when using a driver adapter; the field info
 * is nested under meta.driverAdapterError.cause.constraint.fields instead.
 */
const extractFromDriverAdapter: ColumnExtractor = (meta) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((meta.driverAdapterError as any)?.cause?.constraint?.fields as string[] | undefined) ?? [];

/**
 * Tries each extractor in order and returns the first non-empty result.
 */
function extractConflictColumns(
  meta: Record<string, unknown>,
  extractors: ColumnExtractor[] = [extractFromTarget, extractFromDriverAdapter],
): string[] {
  for (const extractor of extractors) {
    const columns = extractor(meta);
    if (columns.length) return columns;
  }
  return [];
}

/**
 * Maps known Prisma errors to API responses. Unmapped errors are rethrown.
 */
export function handleDBError(error: unknown, res: FastifyReply) {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      // Unique constraint violation
      case 'P2002': {
        const columns = extractConflictColumns(error.meta ?? {});
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
