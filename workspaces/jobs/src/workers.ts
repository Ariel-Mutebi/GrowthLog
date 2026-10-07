import { Worker, createNodeRedisClient } from 'bullmq';
import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';

class GrowthLogWorker extends Worker {
  registry: Map<string, () => Promise<unknown>>;

  constructor (
    name: string,
    redis: RedisClientType,
    public readonly log: Logger,
    public readonly prisma: PrismaClient,
  ) {
    super(
      name,
      async (job) => {
        return this.registry.get(job.name)?.();
      },
      { connection: createNodeRedisClient(redis) },
    );

    this.registry = new Map();

    this.on(
      'failed',
      (job, error) => this.log.error({ job, error }, `${name} failed`),
    );
  }
}

export class DeletionWorker extends GrowthLogWorker {
  constructor(redis: RedisClientType, log: Logger, prisma: PrismaClient) {
    super('deletion', redis, log, prisma);
    this.registry.set('purge-deleted-users', this.purgeDeletedUsers);
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
