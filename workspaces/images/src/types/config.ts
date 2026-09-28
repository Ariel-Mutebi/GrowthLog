export interface Config {
  IMAGES_PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  MINIO_ENDPOINT: string;
  MINIO_ROOT_USER: string;
  MINIO_ROOT_PASSWORD: string;
  PUBLIC_AVATAR_BUCKET: string;
  PUBLIC_MINIO_ENDPOINT: string;
  PUBLIC_MAX_AVATAR_SIZE_BYTES: number;
  PRESIGNED_URL_EXPIRY_SECONDS: number;
  NODE_ENV: 'development' | 'test' | 'production';
}
