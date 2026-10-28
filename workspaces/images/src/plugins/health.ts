import { HeadBucketCommand } from '@aws-sdk/client-s3';
import type { FastifyPluginAsync } from 'fastify';

const report = (isHealthy: boolean) => isHealthy ? 'ok' : 'unavailable';

export const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get('/health/live', async (_req, res) => {
    return res.code(200).send({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    const checks = await Promise.allSettled([
      app.prisma.$queryRaw`SELECT 1`,
      app.storage.send(
        new HeadBucketCommand({ Bucket: app.config.PUBLIC_AVATAR_BUCKET }),
        { abortSignal: AbortSignal.timeout(2000) },
      ),
      app.storage.send(
        new HeadBucketCommand({ Bucket: app.config.PUBLIC_IMAGE_BUCKET }),
        { abortSignal: AbortSignal.timeout(2000) },
      ),
    ]);

    const databaseHealthy = checks[0].status === 'fulfilled';
    const avatarBucketReachable = checks[1].status === 'fulfilled';
    const imageBucketReachable = checks[2].status === 'fulfilled';
    const ready = databaseHealthy && avatarBucketReachable && imageBucketReachable;

    const results = {
      database: report(databaseHealthy),
      avatars: report(avatarBucketReachable),
      images: report(imageBucketReachable),
    };

    if (!ready) {
      app.log.warn(results, 'Image API readiness check failed');
    }

    return res.code(ready ? 200 : 503).send({
      status: report(ready),
      checks: results,
    });
  });
};
