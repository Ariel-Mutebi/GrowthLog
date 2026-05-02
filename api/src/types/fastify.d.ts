import 'fastify';
import type { Authenticator } from '@fastify/passport';

import type { Role } from '../db/enums.js';
import type { PrismaClient } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    auth: Authenticator;
  }
  interface PassportUser {
    id: string;
    role: Role;
  }
}
