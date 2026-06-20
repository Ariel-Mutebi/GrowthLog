/**
 * Test files scope their Redis data by setting REDIS_KEY_PREFIX,
 * preventing the Redis data of test file A from polluting that of
 * test file B as they run concurrently. This function needs to be
 * called wherever a Redis key is created. This function is a no-op
 * in non-testing environments.
 */
export function redisKey(name: string): string {
  return `${process.env.REDIS_KEY_PREFIX ?? ''}${name}`;
}
