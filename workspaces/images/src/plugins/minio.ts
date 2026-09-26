import fp from 'fastify-plugin';
import { S3Client } from '@aws-sdk/client-s3';

export const minioPlugin  = fp(async (app) => {
  const credentials = {
    accessKeyId: app.config.MINIO_ROOT_USER,
    secretAccessKey: app.config.MINIO_ROOT_PASSWORD,
  };

  const minio = new S3Client({
    endpoint: app.config.MINIO_INTERNAL_ENDPOINT,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials,
  });

  const minioPresign = new S3Client({
    endpoint: app.config.MINIO_PUBLIC_ENDPOINT,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials,
  });

  app.decorate('minio', minio);
  app.decorate('minioPresign', minioPresign);
});
