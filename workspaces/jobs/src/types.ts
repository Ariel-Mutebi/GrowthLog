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
}

export interface SMTPCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};
