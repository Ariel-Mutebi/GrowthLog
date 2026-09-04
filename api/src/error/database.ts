import type { FastifyReply } from 'fastify';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Static } from '@sinclair/typebox';
import type { ConflictResponse } from '../typebox/responses.js';

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

interface DriverAdapterError {
  cause?: {
    constraint?: {
      fields?: string[];
    };
  };
}

function extractConflictColumns(meta?: Record<string, unknown>): string[] {
  const driverAdapterError = meta?.driverAdapterError as DriverAdapterError | undefined;
  return driverAdapterError?.cause?.constraint?.fields ?? [];
}

function handleDBConflict(error: PrismaClientKnownRequestError, res: FastifyReply) {
  const columns = extractConflictColumns(error.meta);
  const message = (
    columns.length > 1
      ? `${listFormatter.format(columns)} are already in use`
      : columns.length > 0
        ? `${columns[0]} is already in use`
        : 'A unique constraint was violated'
  );

  return res.code(409).send({
    error: 'Conflict',
    message,
  } satisfies Static<typeof ConflictResponse>);
}

interface CreateWithConflictRetryParams {
  base: string;
  res: FastifyReply;
  conflictColumn: string;
  attempt: (candidate: string) => Promise<void>;
}

const MAX_ATTEMPTS = 100;

/**
 * Retries a Prisma `create` with incrementing suffixes when it hits a
 * unique-constraint conflict (P2002) on `conflictColumn`. Retries instead
 * of pre-checking availability, to avoid TOCTOU races between async requests.
 */
export async function attemptWithConflictRetry(params: CreateWithConflictRetryParams) {
  const { attempt, base, conflictColumn, res } = params;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = i == 0 ? base : `${base}-${i}`;

    try {
      return await attempt(candidate);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        if (extractConflictColumns(error.meta).includes(conflictColumn) && i < MAX_ATTEMPTS - 1) {
          continue;
        }
        return handleDBConflict(error, res);
      }
      throw error;
    }
  }
}

export async function doOrHandleDBConflict(dbFunction: () => Promise<void>, res: FastifyReply) {
  try {
    return await dbFunction();
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return handleDBConflict(error, res);
    }

    throw error;
  }
}
