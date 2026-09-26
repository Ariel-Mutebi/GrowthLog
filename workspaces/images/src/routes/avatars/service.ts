import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import imageSize from 'image-size';
import { fileTypeFromBuffer } from 'file-type';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { PrismaClient, Image } from '@growthlog/db';
import type { S3Client, HeadObjectCommandOutput } from '@aws-sdk/client-s3';

export class ImageNotFoundError extends Error { }
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
}

export class AvatarService {
  private readonly prisma: PrismaClient;
  private readonly minio: S3Client;
  private readonly presigner: S3Client;
  private readonly bucket: string;
  private readonly maxSizeBytes: number;
  private readonly presignedUrlExpirySeconds: number;

  constructor(params: AvatarServiceParams)  {
    this.prisma = params.prisma;
    this.minio = params.minio;
    this.presigner = params.presigner;
    this.bucket = params.bucket;
    this.maxSizeBytes = params.maxSizeBytes;
    this.presignedUrlExpirySeconds = params.presignedUrlExpirySeconds;
  }

  public async requestUpload(uploaderId: string, mimeType: string, sizeBytes: number) {
    if (sizeBytes > this.maxSizeBytes) throw new FileTooLargeError();

    const key = `${this.bucket}/${uploaderId}/${Date.now()}`;

    const imageId = await this.prisma.$transaction(async (transactor) => {
      const image = await transactor.image.create({
        data: {
          key,
          mimeType,
          sizeBytes,
          uploaderId,
        },
      });

      await transactor.avatar.create({
        data: {
          imageId: image.id,
        },
      });

      return image.id;
    });

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
      return this.finalizeAvatarUpload(image, sizeBytes, height, width);
    } catch (error) {
      await this.handleError(image, error);
      throw error;
    }
  }

  private async getOwnedImage(imageId: string, uploaderId: string) {
    const image = await this.prisma.image.findFirst({
      where: {
        id: imageId,
        uploaderId,
      },
    });

    if (!image) {
      throw new ImageNotFoundError();
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

    const size = head.ContentLength!;

    if (size > this.maxSizeBytes) {
      throw new FileTooLargeError();
    }

    return size;
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

  private async finalizeAvatarUpload(image: Image, sizeBytes: number, height: number, width: number) {
    const { updatedImage, oldImageKey } = await this.prisma.$transaction(async (transactor) => {
      const { avatarId } = await transactor.user.findUniqueOrThrow({
        where: {
          id: image.uploaderId,
        },
        select: {
          avatarId: true,
        },
      });

      const updatedImage = await transactor.image.update({
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

      await transactor.user.update({
        where: {
          id: image.uploaderId,
        },
        data: {
          avatarId: image.id,
        },
      });

      let oldImageKey: string | null = null;

      if (avatarId && avatarId !== image.id) {
        const oldImage = await transactor.image.findUniqueOrThrow({
          where: {
            id: avatarId,
          },
        });

        oldImageKey = oldImage.key;

        await transactor.image.delete({
          where: {
            id: avatarId,
          },
        });
      }

      return { updatedImage, oldImageKey };
    });

    if (oldImageKey) {
      await this.minio.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: oldImageKey,
        }),
      );
    }

    return updatedImage;
  }

  private async handleError(image: Image, error: unknown) {
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
  }
}
