import fp from 'fastify-plugin';
import { EmailQueue, DeletionQueue } from '@growthlog/jobs';

export const queuesPlugin = fp(async (app) => {
  const emailer = new EmailQueue(app.redis);
  const cleaner = new DeletionQueue(app.redis);

  app.decorate('emailer', emailer);
  app.decorate('cleaner', cleaner);

  app.addHook('onClose', async () => {
    await emailer.close();
    await cleaner.close();
  });
});
