import fp from 'fastify-plugin';
import { EmailQueue } from '@growthlog/jobs';

export const emailerPlugin = fp(async (app) => {
  const emailer = new EmailQueue(app.redis);
  app.decorate('emailer', emailer);

  app.addHook('onClose', async () => {
    await emailer.close();
  });
});
