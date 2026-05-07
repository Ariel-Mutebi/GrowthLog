import { buildApp } from './app.js';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL! });

async function main() {
  await redisClient.connect();

  const app = buildApp(redisClient);

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
