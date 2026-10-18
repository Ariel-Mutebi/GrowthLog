import type { PrismaClient } from '@growthlog/db';

export class ReadService {
  constructor(private readonly prisma: PrismaClient) {}
}
