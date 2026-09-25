import jwt from 'jsonwebtoken';
import { randomUUIDv7 } from 'node:crypto';
import { RequestUpload } from './schema.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

interface JWTPayload {
  sub: string;
  name: string;
}

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.post('request-upload', {
    schema: RequestUpload,
  }, async (req, res) => {
    const { token, mimeType, sizeBytes } = req.body;

    let payload: JWTPayload;

    try {
      payload = jwt.verify(token, app.config.JWT_SECRET) as JWTPayload;
    } catch {
      return res.code(401).send({
        error: 'Unauthorized',
        message: 'This token is invalid or expired',
      });
    }

    const uploaderId = payload.sub;
    const key = `avatars/${uploaderId}/${randomUUIDv7()}`;

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
  });
};

export default router;
