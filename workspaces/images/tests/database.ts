import { Client } from 'pg';

export const TEMPLATE_DB = 'growthlog_template';

export async function runSql(connectionString: string, sql: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export function withDatabase(baseUrl: string, dbName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}
