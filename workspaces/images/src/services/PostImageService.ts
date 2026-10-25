import { randomUUIDv7 } from 'node:crypto';
import { FileTooLargeError } from './errors.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ImageUploadService } from './ImageService.js';

export class PostNotFoundError extends Error {}

interface RequestUploadParams {
  authorId: string;
  postId: string;
  mimeType: string;
  sizeBytes: number;
}

interface ConfirmUploadParams {
  authorId: string;
  postId: string;
  imageId: string;
}

export class PostImageService extends ImageUploadService<RequestUploadParams, ConfirmUploadParams> {
  async requestUpload(params: RequestUploadParams) {
    const { authorId, postId, mimeType, sizeBytes } = params;

    if (sizeBytes > this.deps.maxSizeBytes) {
      throw new FileTooLargeError(this.deps.maxSizeBytes);
    }

    const key = `${postId}/${randomUUIDv7()}`;

    const imageId = await this.deps.prisma.$transaction(async (transactor) => {
      const post = await transactor.post.findFirst({
        where: {
          authorId,
          id: postId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!post) throw new PostNotFoundError();

      const { id } = await transactor.image.create({
        data: {
          key,
          mimeType,
          sizeBytes,
          postImage: {
            create: { postId },
          },
        },
        select: { id: true },
      });

      return id;
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

  protected async findImage({ imageId, postId, authorId }: ConfirmUploadParams) {
    return await this.deps.prisma.image.findFirst({
      where: {
        id: imageId,
        postImage: {
          post: {
            id: postId,
            authorId,
            deletedAt: null,
          },
        },
      },
    });
  }
}
