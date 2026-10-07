import { Queue, createNodeRedisClient } from 'bullmq';
import type { RedisClientType } from 'redis';

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

export class EmailQueue extends Adapter {
  constructor(redis: RedisClientType) {
    super('email', redis);
  }
}
