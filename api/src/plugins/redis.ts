import fp from 'fastify-plugin';
import { createClient } from 'redis';

export const redisPlugin = fp(async (app) => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('Please provide the REDIS_URL environment variable.');
  
  const redis = createClient({ url, RESP: 3 });
  redis.on('error', (err) => app.log.error('Redis error:', err));

  await redis.connect();
  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
