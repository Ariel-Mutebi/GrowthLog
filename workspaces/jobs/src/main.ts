import pino from 'pino';
import { createClient } from 'redis';
import { createNodeRedisClient, Queue, Worker } from 'bullmq';
import { grimReaper } from './reaper.js';
import { loadEnv } from '@growthlog/env';
import { createPrismaClient } from '@growthlog/db';

const log = pino();

const config = loadEnv(['REDIS_URL', 'DATABASE_URL']);
const connection = createNodeRedisClient(createClient({ url: config.REDIS_URL }));

const prisma = createPrismaClient(config.DATABASE_URL);
await prisma.$connect();

const deletion = new Queue('deletion', { connection });
await deletion.upsertJobScheduler(
  'user-deletion-scheduler',
  { pattern: '0 * * * *' },
  {
    name: 'grim-reaper',
    opts: {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  },
);

const hospice = new Worker(
  'deletion',
  async (job) => {
    if (job.name === 'grim-reaper') {
      return { deletedUsers: await grimReaper(prisma) };
    }
  },
  { connection },
);

hospice.on(
  'failed',
  (job, error) => log.error({ job, error }, 'Death cheated.'),
);

async function shutdown() {
  await hospice.close();
  await deletion.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
