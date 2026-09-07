import createClient from 'openapi-fetch';
import type { paths } from '@growthlog/api';

export const client = createClient<paths>({
  baseUrl: 'http://localhost:3000/',
  credentials: 'include',
});
