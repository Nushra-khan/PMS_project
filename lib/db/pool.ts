import { Pool, PoolClient } from "pg";

import { env } from "@/lib/env";

let pool: Pool | null = null;

export function getDbPool() {
  if (!env.databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      max: 4,
      connectionTimeoutMillis: 1000,
      idleTimeoutMillis: 5000
    });
  }

  return pool;
}

export async function getDbClient() {
  const db = getDbPool();

  if (!db) {
    return null;
  }

  try {
    return (await db.connect()) satisfies PoolClient;
  } catch {
    return null;
  }
}
