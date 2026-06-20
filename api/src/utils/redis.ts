/**
 * Concurrently running test files scope their Redis data by setting REDIS_KEY_PREFIX.
 */
export function redisKey(name: string): string {
  return `${process.env.REDIS_KEY_PREFIX ?? ''}${name}`;
}
