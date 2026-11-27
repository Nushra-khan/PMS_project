/** Automatic review cycles and reminders against the test database (rolled back). */
import "./test-env";

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { getDbPool } from "@/lib/db/pool";
import { runReviewCycleAutomationWith } from "@/lib/db/review-automation";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe("review cycle automation", { skip: !databaseUrl }, () => {
  after(async () => {
    await getDbPool()?.end();
  });

  test("schedules, opens, enrolls and reminds without repeating itself", async () => {
    const pool = getDbPool();
    assert.ok(pool);
    const client = await pool.connect();
    const count = async (sql: string, values: unknown[] = []) =>
      Number((await client.query<{ count: string }>(sql, values)).rows[0]?.count);

    try {
      await client.query("begin");
      // Close existing cycles so only the automatic one is in play.
      await client.query("update public.review_cycles set is_active = false");

      const scheduled = await runReviewCycleAutomationWith(client, "2027-07-10");
      assert.equal(scheduled.cyclesCreated, 1);
      assert.equal(
        await count("select count(*) from public.review_cycles where trigger_date = '2027-08-01' and not is_active"),
        1
      );
      assert.equal((await runReviewCycleAutomationWith(client, "2027-07-11")).cyclesCreated, 0);

      const opened = await runReviewCycleAutomationWith(client, "2027-08-01");
      assert.equal(opened.cyclesActivated, 1);
      // Bi-annual people with a manager who joined 60+ days before Aug 25.
      const expected = await count(
        `select count(*) from public.profiles
         where is_active and review_track = 'biannual' and manager_profile_id is not null
           and date_of_joining < date '2027-08-25' - 60`
      );
      assert.ok(expected > 0);
      assert.equal(opened.enrolled, expected);
      assert.equal(opened.remindersSent, 0);

      const nudged = await runReviewCycleAutomationWith(client, "2027-08-05");
      assert.equal(nudged.remindersSent, expected);
      assert.equal((await runReviewCycleAutomationWith(client, "2027-08-06")).remindersSent, 0);

      const before = await count("select count(*) from public.notifications where title = 'Review escalated' and audience_role = 'admin'");
      const escalated = await runReviewCycleAutomationWith(client, "2027-08-22");
      assert.equal(escalated.remindersSent, expected);
      assert.equal(
        await count("select count(*) from public.notifications where title = 'Review escalated' and audience_role = 'admin'"),
        before + expected
      );
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
