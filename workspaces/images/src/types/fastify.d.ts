import 'fastify';
import type { S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '@growthlog/db';
import type { Config } from './config.ts';
import type { JWTPayload } from '../auth/decode.ts';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    config: Config;
    minio: S3Client;
    minioPresign: S3Client;
  }

  interface FastifyRequest {
    jwt: JWTPayload;
  }
}
