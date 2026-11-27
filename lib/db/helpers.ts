import { PoolClient } from "pg";

import { getCurrentAuthUserId } from "@/lib/auth/current-user";
import { getDbPool } from "@/lib/db/pool";
import { applyUserContext, isRlsEnforced } from "@/lib/db/user-context";

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

type RunMode = "user" | "system";

async function runTask<T>(
  mode: RunMode,
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

  const authUserId = mode === "user" && isRlsEnforced() ? await getCurrentAuthUserId() : null;
  let client: PoolClient;

  try {
    client = await pool.connect();
    dbUnavailableUntil = 0;
  } catch (error) {
    dbUnavailableUntil = Date.now() + DB_RETRY_BACKOFF_MS;
    console.error(`[database] connection failed: ${describeError(error)}`);
    throw new DatabaseUnavailableError();
  }

  const scoped = mode === "user" && isRlsEnforced();

  try {
    if (!scoped) {
      return await task(client);
    }

    await client.query("begin");

    try {
      await applyUserContext(client, authUserId);
      const result = await task(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } catch (error) {
    console.error(`[database] query failed: ${describeError(error)}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs a database task for the signed-in user. With DB_ENFORCE_RLS=true it
 * runs as Supabase's `authenticated` role, so row-level security applies.
 *
 * `fallback` is only returned when no database is configured (local preview)
 * or during `next build`. When a database is configured but unreachable or a
 * query fails, the error is thrown so the page shows an error state instead
 * of silently rendering empty data.
 */
export async function runWithClient<T>(
  fallback: T,
  task: (client: PoolClient) => Promise<T>
) {
  return runTask("user", fallback, task);
}

/**
 * Runs trusted background work (cron automation, escalations, email
 * delivery) with the connection's own privileges. Never use it for data
 * that is shown to or changed on behalf of a user.
 */
export async function runAsSystem<T>(
  fallback: T,
  task: (client: PoolClient) => Promise<T>
) {
  return runTask("system", fallback, task);
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
