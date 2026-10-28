export interface Config {
  IMAGES_PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  STORAGE_ENDPOINT: string;
  STORAGE_REGION: string;
  STORAGE_ACCESS_KEY_ID: string;
  STORAGE_SECRET_ACCESS_KEY: string;
  PUBLIC_AVATAR_BUCKET: string;
  PUBLIC_IMAGE_BUCKET: string;
  PUBLIC_STORAGE_ENDPOINT: string;
  PUBLIC_MAX_AVATAR_SIZE_BYTES: number;
  PUBLIC_MAX_IMAGE_SIZE_BYTES: number;
  PRESIGNED_URL_EXPIRY_SECONDS: number;
  NODE_ENV: 'development' | 'test' | 'production';
}
