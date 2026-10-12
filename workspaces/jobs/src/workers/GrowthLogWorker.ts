import { Worker, createNodeRedisClient } from 'bullmq';
import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';

export class GrowthLogWorker extends Worker {
  registry: Map<string, (data?: unknown) => Promise<unknown>>;

  constructor (
    name: string,
    redis: RedisClientType,
    protected readonly log: Logger,
    protected readonly prisma: PrismaClient,
  ) {
    super(
      name,
      async (job) => this.registry.get(job.name)?.(job.data),
      { connection: createNodeRedisClient(redis) },
    );

    this.registry = new Map();

    this.on('failed', (job, error) => this.log.error({ job, error }, `${name} failed`));
    this.on('completed', (job, result) => this.log.info({ job: job.name, result }, `${name} completed`));
  }
}
