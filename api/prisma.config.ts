import dotenv from 'dotenv';
import { env } from 'prisma/config';
import type { PrismaConfig } from 'prisma';

dotenv.config({ path: '.env.local' });

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
} satisfies PrismaConfig;
