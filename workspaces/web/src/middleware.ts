import { defineMiddleware } from 'astro:middleware';
import { createApiClient } from './server/clients.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createApiClient(context.request.headers.get('cookie'));
  const { data: user } = await client.GET('/api/users');
  context.locals.user = user;
  next();
});
