export interface VerificationEmailJobData {
  userId: string;
  code: string;
}

export interface Emailer {
  sendVerificationEmail(data: VerificationEmailJobData): Promise<void>;
}

export interface Config {
  REDIS_URL: string;
  DATABASE_URL: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  FROM_EMAIL: string;
  STORAGE_ENDPOINT: string;
  STORAGE_REGION: string;
  STORAGE_ACCESS_KEY_ID: string;
  STORAGE_SECRET_ACCESS_KEY: string;
  PUBLIC_IMAGE_BUCKET: string;
}

export interface SMTPCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export interface PurgeUnusedImagesJobData {
  postId: string;
}

export interface Cleaner {
  purgeUnusedImages(data: PurgeUnusedImagesJobData): Promise<void>;
}
