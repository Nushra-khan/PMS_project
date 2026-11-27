import { PoolClient } from "pg";

import { getDbPool } from "@/lib/db/pool";

const DB_RETRY_BACKOFF_MS = 15_000;

let dbUnavailableUntil = 0;

export class DatabaseUnavailableError extends Error {
  constructor(message = "The database is unavailable right now.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isProductionBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Runs a database task. `fallback` is only returned when no database is
 * configured (local preview) or during `next build`. When a database is
 * configured but unreachable or a query fails, the error is thrown so the
 * page shows an error state instead of silently rendering empty data.
 */
export async function runWithClient<T>(
  fallback: T,
  task: (client: PoolClient) => Promise<T>
) {
  if (isProductionBuildPhase()) {
    return fallback;
  }

  const pool = getDbPool();

  if (!pool) {
    return fallback;
  }

  if (Date.now() < dbUnavailableUntil) {
    throw new DatabaseUnavailableError();
  }

  let client: PoolClient;

  try {
    client = await pool.connect();
    dbUnavailableUntil = 0;
  } catch (error) {
    dbUnavailableUntil = Date.now() + DB_RETRY_BACKOFF_MS;
    console.error(`[database] connection failed: ${describeError(error)}`);
    throw new DatabaseUnavailableError();
  }

  try {
    return await task(client);
  } catch (error) {
    console.error(`[database] query failed: ${describeError(error)}`);
    throw error;
  } finally {
    client.release();
  }
}

export async function getDirectReportIds(client: PoolClient, managerProfileId: string) {
  const result = await client.query<{ employee_profile_id: string }>(
    `
      select employee_profile_id
      from public.manager_assignments
      where manager_profile_id = $1
        and is_primary = true
        and (effective_to is null or effective_to >= current_date)
    `,
    [managerProfileId]
  );

  return result.rows.map((row) => row.employee_profile_id);
}

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

export function toDateString(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

export function toDateOnly(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toISOString().slice(0, 10);
}
