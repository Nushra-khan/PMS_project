import { PoolClient } from "pg";

import { getDbPool } from "@/lib/db/pool";

const DB_RETRY_BACKOFF_MS = 15_000;

let dbUnavailableUntil = 0;

function isProductionBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

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
    return fallback;
  }

  let client: PoolClient;

  try {
    client = await pool.connect();
    dbUnavailableUntil = 0;
  } catch {
    dbUnavailableUntil = Date.now() + DB_RETRY_BACKOFF_MS;
    return fallback;
  }

  try {
    return await task(client);
  } catch {
    return fallback;
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
