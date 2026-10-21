import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Static } from '@sinclair/typebox';
import {
  ImageNotFoundError,
  UploadAlreadyFailedError,
  FileTooLargeError,
  FileTypeMismatchError,
  ObjectNotUploadedError,
} from '../services/errors.js';
import type {
  BadRequest,
  Conflict,
  InternalServerError,
  NotFound,
  PayloadTooLarge,
  TooEarly,
  UnprocessableEntity,
} from '../typebox/responses.js';

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
    switch (error.statusCode) {
      case 400:
        return res.code(400).send({
          error: 'BadRequest',
          message: error.message,
        } satisfies Static<typeof BadRequest>);
    
      default:
        return res.code(error.statusCode).send({
          error: 'ClientError',
          message: error.message,
        });
    }
  }

  if (error instanceof ImageNotFoundError) {
    return res.code(404).send({
      error: 'NotFound',
      message: 'No image with this id was found',
    } satisfies Static<typeof NotFound>);
  }

  if (error instanceof UploadAlreadyFailedError) {
    return res.code(409).send({
      error: 'Conflict',
      message: 'Upload failed previously; call request-upload again',
    } satisfies Static<typeof Conflict>);
  }

  if (error instanceof FileTooLargeError) {
    return res.code(413).send({
      error: 'PayloadTooLarge',
      message: `Max image size is ${error.maxBytes / 1024 ** 2} MB`,
    } satisfies Static<typeof PayloadTooLarge>);
  }

  if (error instanceof FileTypeMismatchError) {
    return res.code(422).send({
      error: 'UnprocessableEntity',
      message: 'The type of the uploaded file does not match the declared type',
    } satisfies Static<typeof UnprocessableEntity>);
  }

  if (error instanceof ObjectNotUploadedError) {
    return res.code(425).send({
      error: 'TooEarly',
      message: 'The upload was never received by storage',
    } satisfies Static<typeof TooEarly>);
  }

  req.log.error(error);
  return res.status(500).send({
    error: 'InternalServerError',
    message: 'Something went wrong. Please try again.',
  } satisfies Static<typeof InternalServerError>);
}
