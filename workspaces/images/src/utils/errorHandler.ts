import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Static } from '@sinclair/typebox';
import type { BadRequest, InternalServerError } from '../typebox/responses.js';

// ToolError as in one thrown by typebox validation
interface ToolError {
  statusCode: number;
  message: string;
}

function isToolError(error: unknown): error is ToolError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function errorHandler(error: unknown, req: FastifyRequest, res: FastifyReply) {
  if (isToolError(error)) {
    if (error.statusCode === 400) {
      return res.code(400).send({
        error: 'BadRequest',
        message: error.message,
      } satisfies Static<typeof BadRequest>);
    } else {
      return res.code(error.statusCode).send({
        error: 'ClientError',
        message: error.message,
      });
    }
  }

  req.log.error(error);
  return res.status(500).send({
    error: 'InternalServerError',
    message: 'Something went wrong. Please try again.',
  } satisfies Static<typeof InternalServerError>);
}
