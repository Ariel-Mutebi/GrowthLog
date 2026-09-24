import { loadEnv } from '@growthlog/env';
import type { PrismaConfig } from 'prisma';

const { DATABASE_URL } = loadEnv(['DATABASE_URL']);

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: DATABASE_URL,
  },
} satisfies PrismaConfig;
