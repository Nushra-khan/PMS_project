/**
 * Direct checks that the database itself refuses writes the app should never
 * make, even if a bug in lib/db let one through. Needs TEST_DATABASE_URL.
 */
import "./test-env";

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { getDbPool } from "@/lib/db/pool";
import { applyUserContext } from "@/lib/db/user-context";

const databaseUrl = process.env.TEST_DATABASE_URL;
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const AANYA = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const NEHA = "ffffffff-ffff-4fff-8fff-fffffffffff1";

async function asUser<T>(authUserId: string | null, sql: string, values: unknown[] = []) {
  const pool = getDbPool();
  assert.ok(pool);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await applyUserContext(client, authUserId);
    const result = await client.query<T & Record<string, unknown>>(sql, values);
    return result;
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe("database guards under RLS", { skip: !databaseUrl }, () => {
  after(async () => {
    await getDbPool()?.end();
  });

  test("an employee cannot give themselves a role", async () => {
    await assert.rejects(
      asUser(AANYA, "insert into public.user_roles (profile_id, role) values ($1, 'admin')", [AANYA]),
      /row-level security/
    );
  });

  test("an employee cannot change another person's goal", async () => {
    const result = await asUser(
      AANYA,
      "update public.goals set title = 'hijacked' where owner_profile_id = $1",
      [NEHA]
    );
    assert.equal(result.rowCount, 0);
  });

  test("an employee cannot write audit entries as someone else", async () => {
    await assert.rejects(
      asUser(
        AANYA,
        "insert into public.audit_logs (actor_profile_id, entity_type, action, summary) values ($1, 'goal', 'x', 'x')",
        [ADMIN]
      ),
      /row-level security/
    );
  });

  test("an employee cannot read flags about themselves", async () => {
    const result = await asUser(NEHA, "select id from public.flags where employee_profile_id = $1", [NEHA]);
    assert.equal(result.rowCount, 0);
  });

  test("an employee cannot change app settings", async () => {
    const result = await asUser(AANYA, "update public.app_settings set red_flag_threshold = 5");
    assert.equal(result.rowCount, 0);
  });

  test("nobody signed in sees nothing", async () => {
    const result = await asUser(null, "select id from public.goals");
    assert.equal(result.rowCount, 0);
  });
});
