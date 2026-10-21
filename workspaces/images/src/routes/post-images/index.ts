import { Confirm, RequestUpload } from './schema.js';
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

  app.post('/:postId/request-upload/', {
    schema: RequestUpload,
  }, async (req, res) => {
    const response = await service.requestUpload({
      authorId: req.user.sub,
      postId: req.params.postId,
      mimeType: req.body.mimeType,
      sizeBytes: req.body.sizeBytes,
    });

    return res.code(200).send(response);
  });

  app.post('/:postId/:imageId/confirm', {
    schema: Confirm,
  }, async (req, res) => {
    const image = await service.confirmUpload({
      authorId: req.user.sub,
      postId: req.params.postId,
      imageId: req.params.imageId,
    });

    return res.code(200).send(image);
  });
};

export default router;
