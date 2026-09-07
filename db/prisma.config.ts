import path from 'node:path';
import { env } from 'prisma/config';
import type { PrismaConfig } from 'prisma';

process.loadEnvFile(path.resolve(__dirname, '../.env'));

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
} satisfies PrismaConfig;
