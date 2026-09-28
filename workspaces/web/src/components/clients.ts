import createClient from 'openapi-fetch';
import type { paths as apiPaths } from '@growthlog/api';
import type { paths as imagesPaths } from '@growthlog/images';

const DOMAIN = import.meta.env.PUBLIC_DOMAIN;

export const apiClient = createClient<apiPaths>({
  baseUrl: `${DOMAIN}:${import.meta.env.PUBLIC_API_PORT}`,
  credentials: 'include',
});

export const imagesClient = createClient<imagesPaths>({
  baseUrl: `${DOMAIN}:${import.meta.env.PUBLIC_IMAGES_PORT}`,
});
