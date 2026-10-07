import { runtime } from './runtime.js';
import { opts } from './options.js';
import { DeletionQueue } from './queues.js';
import { DeletionWorker } from './workers.js';

const deletionQueue = new DeletionQueue(runtime.redis);

await deletionQueue.upsertJobScheduler(
  'user-purge-scheduler',
  { pattern: '0 * * * *' },
  {
    name: 'purge-deleted-users',
    opts,
  },
);

const deletionWorker = new DeletionWorker(
  runtime.redis,
  runtime.log,
  runtime.prisma,
);

async function shutdown() {
  await deletionWorker.close();
  await deletionQueue.close();
  await runtime.prisma.$disconnect();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
