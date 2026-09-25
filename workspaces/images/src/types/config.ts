export interface Config {
  IMAGES_PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  MINIO_PUBLIC_ENDPOINT: string;
  MINIO_INTERNAL_ENDPOINT: string;
  MINIO_ROOT_USER: string;
  MINIO_ROOT_PASSWORD: string;
  MINIO_AVATAR_BUCKET: string;
  NODE_ENV: 'development' | 'test' | 'production';
}
