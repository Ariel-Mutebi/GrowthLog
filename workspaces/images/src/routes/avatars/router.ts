import { Confirm, RequestUpload } from './schema.js';
import { decodeJWT } from '../../utils/decodeJWT.js';
import {
  AvatarService,
  FileTooLargeError,
  FileTypeMismatchError,
  ImageNotFoundError,
  ObjectNotUploadedError,
  UploadAlreadyFailedError,
} from './service.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new AvatarService({
    prisma: app.prisma,
    minio: app.minio,
    presigner: app.minioPresign,
    bucket: app.config.MINIO_AVATAR_BUCKET,
    maxSizeBytes: app.config.MAX_AVATAR_SIZE_BYTES,
    presignedUrlExpirySeconds: app.config.PRESIGNED_URL_EXPIRY_SECONDS,
  });

  const maxSizeMegabytes = app.config.MAX_AVATAR_SIZE_BYTES / 1024 ** 2;

  app.post('request-upload', {
    schema: RequestUpload,
  }, async (req, res) => {
    const { token, mimeType, sizeBytes } = req.body;
    const payload = decodeJWT(token, app.config.JWT_SECRET);

    if (!payload) {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'This JWT is invalid or expired or malformed',
      });
    }

    try {
      const response = await service.requestUpload(payload.sub, mimeType, sizeBytes);
      return res.code(200).send(response);
    } catch (error) {
      if (error instanceof FileTooLargeError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: `Max avatar size is ${maxSizeMegabytes}MB`,
        });
      }

      app.log.error(error);

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong. Please try again',
      });
    }
  });

  app.post(':id/confirm', {
    schema: Confirm,
  }, async (req, res) => {
    const payload = decodeJWT(req.body.token, app.config.JWT_SECRET);

    if (!payload) {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'This JWT is invalid or expired or malformed',
      });
    }

    try {
      const image = await service.confirmUpload(req.params.id, payload.sub);
      return res.code(200).send(image);
    } catch (error) {
      if (error instanceof ImageNotFoundError) {
        return res.code(404).send({
          error: 'NotFound',
          message: 'No image with this id was found',
        });
      }

      if (error instanceof UploadAlreadyFailedError) {
        return res.code(409).send({
          error: 'Conflict',
          message: 'Upload failed previously; call request-upload again',
        });
      }

      if (error instanceof ObjectNotUploadedError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'The upload was never received by storage',
        });
      }

      if (error instanceof FileTooLargeError) {
        return res.code(413).send({
          error: 'PayloadTooLarge',
          message: `Max avatar size is ${maxSizeMegabytes}MB`,
        });
      }

      if (error instanceof FileTypeMismatchError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'The type of the uploaded file does not match the declared type',
        });
      }

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong, please retry the request',
      });
    }
  });
};

export default router;
