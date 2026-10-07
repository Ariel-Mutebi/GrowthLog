import { Worker, createNodeRedisClient } from 'bullmq';
import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';

export class DeletionWorker extends Worker {
  private log: Logger;
  private prisma: PrismaClient;
  private registry: Map<string, () => Promise<unknown>>;

  constructor(log: Logger, redis: RedisClientType, prisma: PrismaClient) {
    super(
      'deletion',
      async (job) => {
        return await this.registry.get(job.name)?.();
      },
      { connection: createNodeRedisClient(redis) },
    );

    this.log = log;
    this.prisma = prisma;

    this.registry = new Map();
    this.registry.set('purge-deleted-users', this.purgeDeletedUsers);

    this.on('failed', (job, error) => this.log.error({ job, error }, 'Deletion failed'));
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

    return purged.count;
  }
}
