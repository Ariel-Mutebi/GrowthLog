import fp from 'fastify-plugin';
import { S3Client } from '@aws-sdk/client-s3';

export const storagePlugin  = fp(async (app) => {
  const credentials = {
    accessKeyId: app.config.MINIO_ROOT_USER,
    secretAccessKey: app.config.MINIO_ROOT_PASSWORD,
  };

  const mainClient = new S3Client({
    endpoint: app.config.MINIO_ENDPOINT,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials,
  });

  const presigner = new S3Client({
    endpoint: app.config.PUBLIC_MINIO_ENDPOINT,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials,
  });

  app.decorate('storage', mainClient);
  app.decorate('presigner', presigner);

  app.addHook('onClose', () => {
    mainClient.destroy();
    presigner.destroy();
  });
});
