import fp from 'fastify-plugin';
import { createClient } from 'redis';

export const redisPlugin = fp(async (app) => {
  const redis = createClient({
    url: app.config.REDIS_URL,
    RESP: 3,
  });
  
  redis.on('error', (error) => app.log.error('Redis error:', error));

  await redis.connect();
  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
