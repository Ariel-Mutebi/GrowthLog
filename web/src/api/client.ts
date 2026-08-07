import createClient from 'openapi-fetch';
import type { paths } from './schema.d.ts';

export const client = createClient<paths>({
  baseUrl: 'http://localhost:3000/',
  credentials: 'include',
});
