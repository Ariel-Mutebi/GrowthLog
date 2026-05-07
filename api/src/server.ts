import { buildApp } from './app.js';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL! });

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

async function main() {
  await redisClient.connect();
  const app = buildApp(redisClient);

  async function shutdown (signal: string) {
    app.log.info(`Received ${signal}, shutting down...`);
    try {
      await app.close();
      await redisClient.quit();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM')); // 'terminate' signal: from docker compose down.
  process.on('SIGINT', () => shutdown('SIGINT')); // 'interrupt' signal: from CTRL + C.

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    await redisClient.quit();
    process.exit(1);
  }
}

main();
