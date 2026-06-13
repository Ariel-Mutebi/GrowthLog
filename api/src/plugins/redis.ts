import fp from 'fastify-plugin';
import { createClient } from 'redis';

export const redisPlugin = fp(async (app) => {
  const redis = createClient({ url: process.env.REDIS_URL! });

  redis.on('error', (err) => app.log.error('Redis error:', err));

  await redis.connect();
  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
