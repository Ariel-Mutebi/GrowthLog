import fp from 'fastify-plugin';
import {
  ImageNotFoundError,
  UploadAlreadyFailedError,
  FileTooLargeError,
  FileTypeMismatchError,
  ObjectNotUploadedError,
} from '../services/errors.js';
import type { Static } from '@sinclair/typebox';
import type {
  Conflict,
  NotFound,
  PayloadTooLarge,
  TooEarly,
  UnprocessableEntity,
} from '../typebox/responses.js';

export default fp(async (app) => {
  app.addHook('preHandler', async (req, res) => {
    try {
      await req.jwtVerify();
    } catch {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'This JWT is invalid or expired or malformed',
      });
    }
  });

  app.setErrorHandler((error, req, res) => {
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

    throw error;
  });
});
