import type { FastifyPluginAsync } from 'fastify';

const report = (isHealthy: boolean) => isHealthy ? 'ok' : 'unavailable';

export const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get('/health/live', async (_req, res) => {
    return res.code(200).send({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    const checks = await Promise.allSettled([
      app.prisma.$queryRaw`SELECT 1`,
      app.redis.ping(),
    ]);

    const databaseHealthy = checks[0].status === 'fulfilled';
    const redisHealthy = checks[1].status === 'fulfilled';
    const ready = databaseHealthy && redisHealthy;

    const results = {
      database: report(databaseHealthy),
      redis: report(redisHealthy),
    };

    if (!ready) {
      app.log.warn(results, 'API readiness check failed');
    }

    return res.code(ready ? 200 : 503).send({
      status: report(ready),
      checks: results,
    });
  });
};
