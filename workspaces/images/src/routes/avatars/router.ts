import { Confirm, RequestUpload } from './schema.js';
import { decodeJWT } from '../../utils/decodeJWT.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type {
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import imageSize from 'image-size';
import { fileTypeFromBuffer } from 'file-type';

import type { Image, ImageWhereUniqueInput } from '@growthlog/db';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const router: FastifyPluginAsyncTypebox = async (app) => {
  app.post('request-upload', {
    schema: RequestUpload,
  }, async (req, res) => {
    const { token, mimeType, sizeBytes } = req.body;

    if (sizeBytes > app.config.MAX_AVATAR_SIZE_BYTES) {
      return res.code(400).send({
        error: 'BadRequest',
        message: `The maximum file size for an avatar is ${app.config.MAX_AVATAR_SIZE_BYTES / 1024 ** 2}MB`,
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

    const where = {
      id: req.params.id,
      uploaderId: payload.sub,
    } satisfies ImageWhereUniqueInput;

    const image = await app.prisma.image.findFirst({ where });

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

    let head: HeadObjectCommandOutput;

    const input = {
      Bucket: app.config.MINIO_AVATAR_BUCKET,
      Key: image.key,
    } satisfies HeadObjectCommandInput;

    try {
      head = await app.minio.send(new HeadObjectCommand(input));
    } catch {
      await app.prisma.image.update({
        where,
        data: {
          status: 'FAILED',
        },
      });

      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Avatar upload failed. Call POST request-upload and retry.',
      });
    }

    if (!head.ContentLength || head.ContentLength > app.config.MAX_AVATAR_SIZE_BYTES) {
      try {
        await app.prisma.image.update({
          where,
          data: {
            status: 'FAILED',
          },
        });

        await app.minio.send(new DeleteObjectCommand(input)); 

        return res.code(500).send({
          error: 'InternalServerError',
          message: `The maximum file size for an avatar is ${app.config.MAX_AVATAR_SIZE_BYTES / 1024 ** 2}MB`,
        });
      } catch {
        return res.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to update image status or delete oversized image. Please retry.',
        });
      }
    }

    let object: GetObjectCommandOutput;

    try {
      object = await app.minio.send(
        new GetObjectCommand({
          ...input,
          Range: 'bytes=0-65535', // 64KB
        }),
      );
    } catch {
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to load avatar. Please retry.',
      });
    }

    const buffer = Buffer.from(await object.Body!.transformToByteArray());
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType || detectedType.mime != image.mimeType) {
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'The mime type that you declared differs from the one that you uploaded',
      });
    }

    let verifiedImage: Image;
    const { height, width } = imageSize(buffer);
    
    try {
      verifiedImage = await app.prisma.image.update({
        where,
        data: {
          width,
          height,
          status: 'UPLOADED',
        },
      });
    } catch {
      return res.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to update image properties. Please retry',
      });
    }

    return res.code(200).send(verifiedImage);
  });
};

export default router;
