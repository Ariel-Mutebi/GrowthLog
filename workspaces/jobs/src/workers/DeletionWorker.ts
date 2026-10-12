import { GrowthLogWorker } from './GrowthLogWorker.js';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';
import type { S3Client } from '@aws-sdk/client-s3';

const IMAGE_GRACE_MS = 60 * 60 * 1000; // 1 hour

export class DeletionWorker extends GrowthLogWorker {
  constructor(
    redis: RedisClientType,
    log: Logger,
    prisma: PrismaClient,
    private readonly minio: S3Client,
    private readonly bucket: string,
  ) {
    super('deletion', redis, log, prisma);
    this.registry.set('purge-deleted-users', () => this.purgeDeletedUsers());
    this.registry.set('purge-stale-images', () => this.purgeStaleImages());
  }

  private async purgeDeletedUsers() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const purged = await this.prisma.user.deleteMany({
      where: {
        deletedAt: {
          lte: cutoffDate,
        },
      },
    });

    return { purgedUsers: purged.count };
  }

  private async purgeStaleImages() {
    const cutoff = new Date(Date.now() - IMAGE_GRACE_MS);

    const images = await this.prisma.image.findMany({
      where: {
        createdAt: { lte: cutoff },
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { avatar: null, post: null },
        ],
      },
    });

    let purged = 0;

    for (const image of images) {
      try {
        // Try to delete the object first, so that if it fails, it skips to the catch,
        // and the next run can find the database row and try again.
        await this.minio.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: image.key,
          }),
        );

        await this.prisma.image.delete({
          where: {
            id: image.id,
          },
        });

        purged++;
      } catch (error) {
        this.log.warn({ imageId: image.id, error }, 'failed to purge image');
      }
    }

    return { purgedImages: purged, failed: images.length - purged };
  }
}
