import { env } from 'prisma/config';
import type { PrismaConfig } from 'prisma';

process.loadEnvFile('.env');

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
} satisfies PrismaConfig;
