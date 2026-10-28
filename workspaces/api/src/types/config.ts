export interface Config {
  API_PORT: number;
  REDIS_URL: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  SESSION_SECRET: string;
  REDIS_KEY_PREFIX?: string;
  PUBLIC_STORAGE_ENDPOINT: string;
  PUBLIC_IMAGE_BUCKET: string;
  NODE_ENV: 'development' | 'production' | 'test';
};
