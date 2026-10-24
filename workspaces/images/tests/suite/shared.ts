import type { TestEnv } from '../test-env.js';

export const UNKNOWN_ID = 'cdoesnotexist'.padEnd(24, '0');

// These must match PUBLIC_MAX_AVATAR_SIZE_BYTES / PUBLIC_MAX_IMAGE_SIZE_BYTES in test-env.ts.
export const AVATAR_MAX_BYTES = 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Smallest valid 1x1 PNG, accepted by file-type and image-size.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Each test file runs in its own worker with its own database, so a per-module
// counter is enough to keep unique columns (username, email, slug) from colliding.
let counter = 0;

export async function makeUser(env: TestEnv) {
  const n = ++counter;
  return await env.app.prisma.user.create({
    data: {
      forename: 'Test',
      surname: 'User',
      username: `user${n}`,
      email: `user${n}@example.com`,
      password: 'not-a-real-hash',
    },
  });
}

export async function makePost(env: TestEnv, authorId: string, overrides: { deletedAt?: Date } = {}) {
  const n = ++counter;
  return await env.app.prisma.post.create({
    data: { authorId, title: `Post ${n}`, slug: `post-${n}`, ...overrides },
  });
}
