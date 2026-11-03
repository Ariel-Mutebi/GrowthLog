import { runtime } from './runtime.js';
import { opts } from './options.js';
import { DeletionQueue } from './queues.js';
import { DeletionWorker } from './workers/DeletionWorker.js';
import { EmailWorker } from './workers/EmailWorker.js';

const deletionQueue = new DeletionQueue(runtime.redis);

await deletionQueue.upsertJobScheduler(
  'user-purge-scheduler',
  { pattern: '0 * * * *' },
  {
    name: 'purge-deleted-users',
    opts,
  },
);

await deletionQueue.upsertJobScheduler(
  'image-purge-scheduler',
  { pattern: '*/15 * * * *' },
  {
    name: 'purge-stale-images',
    opts,
  },
);

const deletionWorker = new DeletionWorker(
  runtime.redis,
  runtime.log,
  runtime.prisma,
  runtime.storage,
  runtime.config.PUBLIC_IMAGE_BUCKET,
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
    secure: runtime.config.NODE_ENV === 'production',
  },
);

await emailWorker.check();

async function shutdown() {
  console.log('closing deletionWorker');
  await deletionWorker.close();
  console.log('closing deletionQueue');
  await deletionQueue.close();
  console.log('closing emailWorker');
  await emailWorker.close();
  console.log('stopping runtime');
  await runtime.stop();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
