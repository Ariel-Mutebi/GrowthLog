import fp from 'fastify-plugin';
import fastifyRateLimit, {
  type FastifyRateLimitStore,
} from '@fastify/rate-limit';
import type { RouteOptions } from 'fastify';

export const rateLimitPlugin = fp(async (app) => {
  /*
    * @fastify/rate-limit's built-in Redis support requires ioredis, not node-redis.
    * This store implements the plugin's custom store interface, connecting @fastify/
    * rate-limit to the node-redis client via the app.redis closure.
  */
  class RedisStore implements FastifyRateLimitStore {
    private timeWindow: number;

    constructor(opts: { timeWindow?: number }) {
      this.timeWindow = opts.timeWindow ?? 60 * 1000;
    }

    incr(
      key: string,
      cb: (err: Error | null, result?: { current: number; ttl: number }) => void,
    ) {
      app.redis
        .multi()
        .incr(key)
        .pExpire(key, this.timeWindow, 'NX')
        .pTTL(key)
        .exec()
        .then(([current, , ttl]) => {
          cb(null, {
            current: Number(current),
            ttl: Math.max(Number(ttl), 0),
          });
        })
        .catch(err => cb(err));
    }

    child(routeOptions: RouteOptions & { path: string; prefix: string }) {
      const rateLimit = routeOptions.config?.rateLimit;

      return new RedisStore({
        timeWindow:
          rateLimit && typeof rateLimit.timeWindow === 'number'
            ? rateLimit.timeWindow
            : this.timeWindow,
      });
    }
  }

  app.register(fastifyRateLimit, {
    max: 60,
    timeWindow: 60 * 1000,
    store: RedisStore,
  });
});
