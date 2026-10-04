import { defineMiddleware } from 'astro:middleware';
import { createApiClient } from './server/clients.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createApiClient(context.request.headers.get('cookie'));

  try {
    const { data: user } = await client.GET('/api/users');
    context.locals.user = user;
  } catch (error) {
    console.log(error);
  }

  next();
});
