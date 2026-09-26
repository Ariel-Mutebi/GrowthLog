import { Confirm, RequestUpload } from './schema.js';
import { decodeJWT } from '../../utils/decodeJWT.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.post('request-upload', {
    schema: RequestUpload,
  }, async (req, res) => {
    const { token, mimeType, sizeBytes } = req.body;

    if (sizeBytes > app.config.MAX_AVATAR_SIZE_BYTES) {
      return res.code(400).send({
        error: 'BadRequest',
        message: `This is beyond the maximum file size for an avatar ${app.config.MAX_AVATAR_SIZE_BYTES / 1024 ** 2}MB`,
      });
    }

    const payload = decodeJWT(token, app.config.JWT_SECRET);

    if (!payload) {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'This JWT is invalid or expired or malformed',
      });
    }

    const uploaderId = payload.sub;
    const key = `${app.config.MINIO_AVATAR_BUCKET}/${uploaderId}/${Date.now()}`;

    const imageId = await app.prisma.$transaction(async (client) => {
      const image = await client.image.create({
        data: {
          key,
          mimeType,
          sizeBytes,
          uploaderId,
        },
      });

      await client.avatar.create({
        data: {
          imageId: image.id,
        },
      });

      return image.id;
    });

    const uploadUrl = await getSignedUrl(
      app.minioPresign,
      new PutObjectCommand({
        Bucket: app.config.MINIO_AVATAR_BUCKET,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: app.config.PRESIGNED_URL_EXPIRY_SECONDS },
    );

    return res.code(200).send({ imageId, uploadUrl });
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

    const image = await app.prisma.image.findFirst({
      where: {
        id: req.params.id,
        uploaderId: payload.sub,
      },
    });

    if (!image) {
      return res.code(404).send({
        error: 'NotFound',
        message: 'No image with this id was found',
      });
    }

    if (image.status === 'UPLOADED') {
      return res.code(200).send(image);
    }

    if (image.status === 'FAILED') {
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Avatar upload failed. Call POST request-upload and retry.',
      });
    }
  });
};

export default router;
