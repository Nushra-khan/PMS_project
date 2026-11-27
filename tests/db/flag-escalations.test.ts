/** Flag auto-escalation against the seeded test database (rolled back). */
import "./test-env";

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { escalateStaleFlags } from "@/lib/db/flag-escalations";
import { getDbPool } from "@/lib/db/pool";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe("flag escalation", { skip: !databaseUrl }, () => {
  after(async () => {
    await getDbPool()?.end();
  });

  test("escalates stale flags once and notifies the secondary Admin", async () => {
    const pool = getDbPool();
    assert.ok(pool);
    const client = await pool.connect();

    try {
      await client.query("begin");
      const before = await client.query<{ count: string }>(
        "select count(*) from public.flags where status in ('open', 'under_review')"
      );

      const escalated = await escalateStaleFlags(client, new Date("2027-01-01T00:00:00Z"));
      assert.equal(escalated, Number(before.rows[0]?.count));
      assert.ok(escalated > 0);

      const statuses = await client.query<{ status: string }>("select distinct status from public.flags");
      assert.deepEqual(statuses.rows.map((row) => row.status).sort(), ["escalated"]);

      const notices = await client.query<{ count: string }>(
        "select count(*) from public.notifications where title = 'Flag escalated'"
      );
      assert.equal(Number(notices.rows[0]?.count), escalated);

      // Running again does nothing: escalated flags are no longer open.
      assert.equal(await escalateStaleFlags(client, new Date("2027-01-01T00:00:00Z")), 0);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  test("skips flags an Admin acted on recently", async () => {
    const pool = getDbPool();
    assert.ok(pool);
    const client = await pool.connect();

    try {
      await client.query("begin");
      await client.query(
        `insert into public.flag_actions (flag_id, actor_profile_id, action, created_at)
         select id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'review', '2026-12-30T00:00:00Z' from public.flags`
      );
      assert.equal(await escalateStaleFlags(client, new Date("2027-01-01T00:00:00Z")), 0);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  test("leaves recent flags alone", async () => {
    const pool = getDbPool();
    assert.ok(pool);
    const client = await pool.connect();

    try {
      await client.query("begin");
      assert.equal(await escalateStaleFlags(client, new Date("2026-02-19T00:00:00Z")), 0);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
