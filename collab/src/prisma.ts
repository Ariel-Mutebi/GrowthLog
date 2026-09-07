import { createPrismaClient } from '@growthlog/db';
import { config } from './config.js';

export const prisma = createPrismaClient(config.DATABASE_URL);
