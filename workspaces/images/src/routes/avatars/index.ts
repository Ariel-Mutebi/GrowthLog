import { Confirm, RequestUpload } from './schema.js';
import { AvatarService } from '../../services/AvatarService.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  const service = new AvatarService({
    prisma: app.prisma,
    minio: app.minio,
    logError: app.log.error,
    presigner: app.minioPresign,
    bucket: app.config.PUBLIC_AVATAR_BUCKET,
    maxSizeBytes: app.config.PUBLIC_MAX_AVATAR_SIZE_BYTES,
    presignedUrlExpirySeconds: app.config.PRESIGNED_URL_EXPIRY_SECONDS,
  });

  app.post('/request-upload', {
    schema: RequestUpload,
  }, async (req, res) => {
    const permission = await service.requestUpload({
      userId: req.user.sub,
      mimeType: req.body.mimeType,
      sizeBytes: req.body.sizeBytes,
    });

    return res.code(200).send(permission);
  });

  app.post('/:id/confirm', {
    schema: Confirm,
  }, async (req, res) => {
    const image = await service.confirmUpload({
      userId: req.user.sub,
      imageId: req.params.id,
    });

    return res.code(200).send(image);
  });
};

export default router;
