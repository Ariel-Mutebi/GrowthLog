import { randomUUIDv7 } from 'node:crypto';
import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import imageSize from 'image-size';
import { fileTypeFromBuffer } from 'file-type';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { FastifyLogFn } from 'fastify';
import type { PrismaClient, Image } from '@growthlog/db';
import type { S3Client, HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import { PrismaClientKnownRequestError } from '@growthlog/db/src/generated/internal/prismaNamespace.js';

export class AvatarNotFoundError extends Error { }
export class UploadAlreadyFailedError extends Error { }
export class ObjectNotUploadedError extends Error { }
export class FileTooLargeError extends Error { }
export class FileTypeMismatchError extends Error { }

interface AvatarServiceParams {
  prisma: PrismaClient;
  minio: S3Client;
  presigner: S3Client;
  bucket: string;
  maxSizeBytes: number;
  presignedUrlExpirySeconds: number;
  logError: FastifyLogFn;
}

export class AvatarService {
  private readonly prisma: PrismaClient;
  private readonly minio: S3Client;
  private readonly presigner: S3Client;
  private readonly bucket: string;
  private readonly maxSizeBytes: number;
  private readonly presignedUrlExpirySeconds: number;
  private readonly logError: FastifyLogFn;

  constructor(params: AvatarServiceParams)  {
    this.prisma = params.prisma;
    this.minio = params.minio;
    this.presigner = params.presigner;
    this.bucket = params.bucket;
    this.maxSizeBytes = params.maxSizeBytes;
    this.presignedUrlExpirySeconds = params.presignedUrlExpirySeconds;
    this.logError = params.logError;
  }

  public async requestUpload(uploaderId: string, mimeType: string, sizeBytes: number) {
    if (sizeBytes > this.maxSizeBytes) throw new FileTooLargeError();

    const key = `${uploaderId}/${randomUUIDv7()}`;
    let oldKey: string | undefined = undefined;

    const imageId = await this.prisma.$transaction(async (transactor) => {
      try {
        const oldAvatar = await transactor.avatar.delete({
          where: {
            userId: uploaderId,
          },
          select: {
            image: {
              select: {
                key: true,
              },
            },
          },
        });
        oldKey = oldAvatar.image.key;
      } catch (error) {
        if (!(error instanceof PrismaClientKnownRequestError && error.code == 'P2025')) {
          throw error;
        }
      }

      const image = await transactor.image.create({
        data: {
          key,
          mimeType,
          sizeBytes,
        },
      });

      await transactor.avatar.create({
        data: {
          imageId: image.id,
          userId: uploaderId,
        },
      });

      return image.id;
    });

    if (oldKey) {
      await this.minio.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: oldKey,
        }),
      );
    }

    const uploadUrl = await getSignedUrl(
      this.presigner,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: this.presignedUrlExpirySeconds },
    );

    return { imageId, uploadUrl };
  }

  public async confirmUpload(imageId: string, uploaderId: string) {
    const image = await this.getOwnedImage(imageId, uploaderId);

    if (image.status === 'UPLOADED') {
      return image;
    };

    if (image.status === 'FAILED') {
      throw new UploadAlreadyFailedError();
    };

    try {
      const sizeBytes = await this.verifyObjectUploaded(image.key);
      const { height, width } = await this.verifyFileContent(image.key, image.mimeType);

      return await this.prisma.image.update({
        where: {
          id: image.id,
        },
        data: {
          status: 'UPLOADED',
          sizeBytes,
          height,
          width,
        },
      });
    } catch (error) {
      if (
        error instanceof ObjectNotUploadedError ||
        error instanceof FileTooLargeError ||
        error instanceof FileTypeMismatchError
      ) {
        await this.markFailed(image, error);
      }
      throw error;
    }
  }

  private async getOwnedImage(imageId: string, uploaderId: string) {
    const image = await this.prisma.image.findFirst({
      where: {
        id: imageId,
        avatar: {
          userId: uploaderId,
        },
      },
    });

    if (!image) {
      throw new AvatarNotFoundError();
    }

    return image;
  }

  private async verifyObjectUploaded(key: string) {
    let head: HeadObjectCommandOutput;

    try {
      head = await this.minio.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch {
      throw new ObjectNotUploadedError();
    }

    if (head.ContentLength === undefined) throw new ObjectNotUploadedError();
    if (head.ContentLength > this.maxSizeBytes) throw new FileTooLargeError();

    return head.ContentLength;
  }

  private async verifyFileContent(key: string, declaredMimeType: string) {
    const object = await this.minio.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: 'bytes=0-65535', // first 64KB
      }),
    );
    const bytes = await object.Body!.transformToByteArray();

    const buffer = Buffer.from(bytes);
    const mimeType = await fileTypeFromBuffer(buffer);

    if (mimeType?.mime !== declaredMimeType) {
      throw new FileTypeMismatchError();
    }

    return imageSize(buffer);
  }

  private async markFailed(image: Image, error: unknown) {
    try {
      await this.prisma.image.update({
        where: {
          id: image.id,
        },
        data: {
          status: 'FAILED',
        },
      });
      
      if (error instanceof FileTooLargeError || error instanceof FileTypeMismatchError) {
        await this.minio.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: image.key,
          }),
        );
      }
    } catch (error) {
      this.logError(error);
    }
  }
}
