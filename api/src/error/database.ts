import type { FastifyReply } from 'fastify';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
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

export function extractConflictColumns(meta?: Record<string, unknown>): string[] {
  const driverAdapterError = meta?.driverAdapterError as DriverAdapterError | undefined;
  return driverAdapterError?.cause?.constraint?.fields ?? [];
}

export function handleDBConflict(error: PrismaClientKnownRequestError, res: FastifyReply) {
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
