import { runtime } from './runtime.js';
import { opts } from './options.js';
import { DeletionQueue } from './queues.js';
import { DeletionWorker, EmailWorker } from './workers.js';

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

const emailWorker = new EmailWorker(
  runtime.redis,
  runtime.log,
  runtime.prisma,
  {
    host: runtime.config.SMTP_HOST,
    port: runtime.config.SMTP_PORT,
    user: runtime.config.SMTP_USER,
    pass: runtime.config.SMTP_PASS,
    from: runtime.config.FROM_EMAIL,
  },
);

await emailWorker.check();

async function shutdown() {
  await deletionWorker.close();
  await deletionQueue.close();
  await emailWorker.close();
  await runtime.prisma.$disconnect();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
