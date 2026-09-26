import { randomUUIDv7 } from 'node:crypto';
import { RequestUpload } from './schema.js';
import { decodeJWT } from '../../utils/decodeJWT.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
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

    const uploaderId = payload.sub;
    const key = `${app.config.MINIO_AVATAR_BUCKET}/${uploaderId}/${randomUUIDv7()}`;

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
};

export default router;
