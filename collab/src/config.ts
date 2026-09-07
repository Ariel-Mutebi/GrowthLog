process.loadEnvFile(new URL('../../.env', import.meta.url));

const required = [
  'WS_PORT',
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

type RequiredEnv = (typeof required)[number];

function loadConfig(): Record<RequiredEnv, string> {
  const missing: string[] = [];
  const config = {} as Record<RequiredEnv, string>;

  for (const key of required) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else {
      config[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return config;
}

export const config = loadConfig();
