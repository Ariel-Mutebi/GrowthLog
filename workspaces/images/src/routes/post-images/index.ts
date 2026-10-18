import { Confirm, RequestUpload } from './schema.js';
import {
  ImageNotFoundError,
  UploadAlreadyFailedError,
  ObjectNotUploadedError,
  FileTooLargeError,
  FileTypeMismatchError,
} from '../../services/errors.js';
import { PostImageService } from '../../services/PostImageService.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new PostImageService({
    prisma: app.prisma,
    minio: app.minio,
    logError: app.log.error,
    presigner: app.minioPresign,
    bucket: app.config.PUBLIC_IMAGE_BUCKET,
    maxSizeBytes: app.config.PUBLIC_MAX_IMAGE_SIZE_BYTES,
    presignedUrlExpirySeconds: app.config.PRESIGNED_URL_EXPIRY_SECONDS,
  });

  const mb = app.config.PUBLIC_MAX_IMAGE_SIZE_BYTES / 1024 ** 2;

  app.post('/:postId/request-upload/', {
    schema: RequestUpload,
  }, async (req, res) => {
    try {
      const response = await service.requestUpload({
        authorId: req.user.sub,
        postId: req.params.postId,
        mimeType: req.body.mimeType,
        sizeBytes: req.body.sizeBytes,
      });
      return res.code(200).send(response);
    } catch (error) {
      if (error instanceof FileTooLargeError) {
        return res.code(400).send({
          error: 'BadRequest',
          message: `Max post image size is ${mb} MB`,
        });
      }

      throw error;
    }
  });

  app.post('/:postId/:imageId/confirm', {
    schema: Confirm,
  }, async (req, res) => {
    try {
      const image = await service.confirmUpload({
        authorId: req.user.sub,
        postId: req.params.postId,
        imageId: req.params.imageId,
      });
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

      if (error instanceof FileTooLargeError) {
        return res.code(413).send({
          error: 'PayloadTooLarge',
          message: `Max post image size is ${mb} MB`,
        });
      }

      if (error instanceof FileTypeMismatchError) {
        return res.code(422).send({
          error: 'UnprocessableEntity',
          message: 'The type of the uploaded file does not match the declared type',
        });
      }

      if (error instanceof ObjectNotUploadedError) {
        return res.code(425).send({
          error: 'TooEarly',
          message: 'The upload was never received by storage',
        });
      }

      throw error;
    }
  });
};

export default router;
