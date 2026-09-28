import createClient from 'openapi-fetch';
import { PUBLIC_API_URL, PUBLIC_IMAGES_URL } from 'astro:env/client';
import type { paths as apiPaths } from '@growthlog/api';
import type { paths as imagesPaths } from '@growthlog/images';

export const apiClient = createClient<apiPaths>({
  baseUrl: PUBLIC_API_URL,
  credentials: 'include',
});

export const imagesClient = createClient<imagesPaths>({
  baseUrl: PUBLIC_IMAGES_URL,
});
