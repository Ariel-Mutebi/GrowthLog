import { Queue, createNodeRedisClient } from 'bullmq';
import { opts } from './options.js';
import type { RedisClientType } from 'redis';
import type { Emailer, VerificationEmailJobData } from './types.js';

class Adapter extends Queue {
  constructor(name: string, raw: RedisClientType) {
    super(name, { connection: createNodeRedisClient(raw) });
  }
}

export class DeletionQueue extends Adapter {
  constructor(redis: RedisClientType) {
    super('deletion', redis);
  }
}

export class EmailQueue extends Adapter implements Emailer {
  constructor(redis: RedisClientType) {
    super('email', redis);
  }

  async sendVerificationEmail(data: VerificationEmailJobData): Promise<void> {
    await this.add('send-verification-email', data, opts);
  }
}
