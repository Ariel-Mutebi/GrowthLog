import { defineMiddleware } from 'astro:middleware';
import { createApiClient } from './server/clients.ts';
import type { User } from './types/backend.ts';

const cache = new Map<string, { user: User; expires: number }>();

export const onRequest = defineMiddleware(async (context, next) => {
  const cookie = context.request.headers.get('cookie') ?? '';
  const hit = cache.get(cookie);

  if (hit && hit.expires > Date.now()) {
    context.locals.user = hit.user;
  } else {
    try {
      const { data: user } = await createApiClient(cookie).GET('/api/users');

      if (user) {
        context.locals.user = user;
        cache.set(cookie, { user, expires: Date.now() + 60 * 60 * 1000 });
      }
    } catch (error) {
      console.error(error);
    }
  }

  return next();
});
