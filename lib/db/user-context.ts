import { PoolClient } from "pg";

import { getCurrentAuthUserId } from "@/lib/auth/current-user";

/**
 * Row-level security support for the direct Postgres connection.
 *
 * DATABASE_URL connects as the database owner, which bypasses RLS. When
 * DB_ENFORCE_RLS=true, user-facing work runs inside a transaction that switches
 * to Supabase's `authenticated` role and sets the user's JWT claims, so
 * auth.uid() and every policy in supabase/migrations apply. Requests with no
 * signed-in user run as `anon`, which the policies grant nothing.
 */
export function isRlsEnforced() {
  return process.env.DB_ENFORCE_RLS === "true";
}

export async function applyUserContext(client: PoolClient, authUserId: string | null) {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(
      authUserId ? { sub: authUserId, role: "authenticated" } : { role: "anon" }
    )
  ]);
  await client.query(authUserId ? "set local role authenticated" : "set local role anon");
}

/**
 * Starts a transaction for a user action. With DB_ENFORCE_RLS=true the rest of
 * the transaction runs as the signed-in user, so policies limit the writes.
 */
export async function beginUserTransaction(client: PoolClient) {
  await client.query("begin");

  if (isRlsEnforced()) {
    await applyUserContext(client, await getCurrentAuthUserId());
  }
}

/**
 * Runs a block of trusted system writes (audit logs, notifications,
 * automation) with the connection's own privileges, then drops back to the
 * user's role. Only wrap code that must not be limited by the user's access.
 * Must be called inside a transaction.
 */
export async function withSystemRole<T>(client: PoolClient, task: () => Promise<T>) {
  if (!isRlsEnforced()) {
    return task();
  }

  const previous = await client.query<{ role: string }>("select current_user as role");
  await client.query("set local role none");

  try {
    return await task();
  } finally {
    const role = previous.rows[0]?.role;

    if (role === "authenticated" || role === "anon") {
      await client.query(`set local role ${role}`);
    }
  }
}
