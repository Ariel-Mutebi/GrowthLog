import { randomUUIDv7 } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileTooLargeError } from '../../classes/errors.js';
import { ImageUploadService } from '../../classes/ImageService.js';

interface RequestUploadParams {
  userId: string;
  mimeType: string;
  sizeBytes: number;
}

interface ConfirmUploadParams {
  userId: string;
  imageId: string;
}

export class AvatarService extends ImageUploadService<ConfirmUploadParams> {
  async requestUpload(params: RequestUploadParams) {
    const { userId, mimeType, sizeBytes } = params;

    if (sizeBytes > this.deps.maxSizeBytes) {
      throw new FileTooLargeError();
    }

    const key = `${userId}/${randomUUIDv7()}`;

    const imageId = await this.deps.prisma.$transaction(async (transactor) => {
      await transactor.avatar.deleteMany({
        where: { userId },
      });

      const image = await transactor.image.create({
        data: {
          key,
          mimeType,
          sizeBytes,
          avatar: {
            create: { userId },
          },
        },
        select: { id: true },
      });

      return image.id;
    });

    const uploadUrl = await getSignedUrl(
      this.deps.presigner,
      new PutObjectCommand({
        Bucket: this.deps.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: this.deps.presignedUrlExpirySeconds },
    );

    return { imageId, uploadUrl };
  }

  protected async findImage({ userId, imageId }: ConfirmUploadParams) {
    return await this.deps.prisma.image.findFirst({
      where: {
        id: imageId,
        avatar: { userId },
      },
    });
  }
}
