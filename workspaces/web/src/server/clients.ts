import createClient, { type Middleware } from 'openapi-fetch';
import { PUBLIC_API_URL } from 'astro:env/client';
import type { paths as apiPaths } from '@growthlog/api';

export function createApiClient(cookieHeader: string | null) {
  const forwardCookie: Middleware = {
    onRequest({ request }) {
      if (cookieHeader) {
        request.headers.set('cookie', cookieHeader);
      }
      return request;
    },
  };

  const client = createClient<apiPaths>({ baseUrl: PUBLIC_API_URL });
  client.use(forwardCookie);

  return client;
}
