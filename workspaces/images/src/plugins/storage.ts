import fp from 'fastify-plugin';
import { S3Client } from '@aws-sdk/client-s3';

export const storagePlugin  = fp(async (app) => {
  const credentials = {
    accessKeyId: app.config.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: app.config.STORAGE_SECRET_ACCESS_KEY,
  };

  const storage = new S3Client({
    endpoint: app.config.STORAGE_ENDPOINT,
    region: app.config.STORAGE_REGION,
    credentials,
    forcePathStyle: true,
  });

  const presigner = new S3Client({
    endpoint: app.config.PUBLIC_STORAGE_ENDPOINT,
    region: app.config.STORAGE_REGION,
    credentials,
    forcePathStyle: true,
  });

  app.decorate('storage', storage);
  app.decorate('presigner', presigner);

  app.addHook('onClose', () => {
    storage.destroy();
    presigner.destroy();
  });
});
