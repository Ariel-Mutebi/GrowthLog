import {
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import imageSize from 'image-size';
import { fileTypeFromBuffer } from 'file-type';
import {
  FileTooLargeError,
  FileTypeMismatchError,
  ImageNotFoundError,
  ObjectNotUploadedError,
  UploadAlreadyFailedError,
} from './errors.js';

import type { FastifyLogFn } from 'fastify';
import type { S3Client } from '@aws-sdk/client-s3';
import type { Image, PrismaClient } from '@growthlog/db';

interface ServiceDependencies {
  prisma: PrismaClient;
  minio: S3Client;
  presigner: S3Client;
  bucket: string;
  maxSizeBytes: number;
  logError: FastifyLogFn;
  presignedUrlExpirySeconds: number;
}

interface RequestUploadReturn {
  imageId: string;
  uploadUrl: string;
}

export abstract class ImageUploadService<T> {
  constructor (protected readonly deps: ServiceDependencies) {}

  abstract requestUpload(params: never): Promise<RequestUploadReturn>;
  protected abstract findImage(params: T): Promise<Image | null>;

  async confirmUpload(params: T): Promise<Image> {
    const image = await this.findImage(params);

    if (!image) {
      throw new ImageNotFoundError();
    }

    if (image.status === 'UPLOADED') {
      return image;
    };

    if (image.status === 'FAILED') {
      throw new UploadAlreadyFailedError();
    };

    try {
      const sizeBytes = await this.verifyObjectUploaded(image.key);
      const { height, width } = await this.verifyFileContent(image.key, image.mimeType);

      return await this.deps.prisma.image.update({
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
        error instanceof FileTooLargeError ||
        error instanceof FileTypeMismatchError
      ) {
        await this.deps.prisma.image.update({
          where: { id: image.id },
          data: { status: 'FAILED' },
        });
      }
      throw error;
    }
  };

  private async verifyObjectUploaded(key: string) {
    const { ContentLength } = await this.deps.minio.send(
      new HeadObjectCommand({
        Bucket: this.deps.bucket,
        Key: key,
      }),
    );

    if (!ContentLength) throw new ObjectNotUploadedError();
    if (ContentLength > this.deps.maxSizeBytes) throw new FileTooLargeError();

    return ContentLength;
  }

  private async verifyFileContent(key: string, declaredMimeType: string) {
    const { Body } = await this.deps.minio.send(
      new GetObjectCommand({
        Bucket: this.deps.bucket,
        Key: key,
        Range: 'bytes=0-262143',
      }),
    );

    const bytes = await Body!.transformToByteArray();
    const mimeType = await fileTypeFromBuffer(bytes);

    if (mimeType?.mime !== declaredMimeType) {
      throw new FileTypeMismatchError();
    }

    return imageSize(bytes);
  }
}
