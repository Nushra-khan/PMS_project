/**
 * Runs each user action (the lib/db write functions the server actions call)
 * with RLS off and on, inside a transaction that is rolled back, and checks
 * both runs succeed or fail the same way and touch the same rows. Needs
 * TEST_DATABASE_URL (see scripts/sql/setup-test-db.sh).
 */
import "./test-env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { setAuthUserIdResolverForTests } from "@/lib/auth/current-user";
import { getDbPool } from "@/lib/db/pool";
import { applyUserContext } from "@/lib/db/user-context";
import type { AppSession, Role } from "@/lib/types";

import type { PoolClient } from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const MAYA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const ARJUN = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const AANYA = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const ROHAN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const NEHA = "ffffffff-ffff-4fff-8fff-fffffffffff1";
const CYCLE_BIANNUAL = "12121212-1212-4212-8212-121212121212";
const CYCLE_QUARTERLY = "34343434-3434-4343-8434-343434343434";

function sessionFor(profileId: string, role: Role): AppSession {
  return {
    role,
    userId: profileId,
    workspaceProfileId: profileId,
    sessionMode: "live",
    authUserId: profileId,
    profile: {
      id: profileId,
      name: "Test",
      email: "test@pms.local",
      title: "Test",
      department: "Test",
      teamId: "unassigned",
      reviewTrack: "biannual",
      roles: [role],
      dateOfJoining: "2024-01-01"
    }
  };
}

type Action = (client: PoolClient, session: AppSession) => Promise<unknown>;
// `forbidden` scenarios only need to fail; RLS may report a different reason.
type Scenario = { name: string; actor: [string, Role]; run: Action; forbidden?: boolean };

async function loadScenarios(): Promise<Scenario[]> {
  const goals = await import("@/lib/db/goals");
  const flags = await import("@/lib/db/flags");
  const probation = await import("@/lib/db/probation");
  const reviews = await import("@/lib/db/reviews");
  const admin = await import("@/lib/db/admin");

  return [
    {
      name: "employee drafts a goal",
      actor: [AANYA, "employee"],
      run: (c, s) =>
        goals.createGoalRecord(c, s, {
          title: "Learn the billing domain",
          summary: "Pair with the billing team for two sprints.",
          scope: "individual",
          weightage: 10,
          dueDate: "2026-12-31",
          intent: "draft"
        })
    },
    {
      name: "employee submits a goal for approval",
      actor: [NEHA, "employee"],
      run: (c, s) =>
        goals.createGoalRecord(c, s, {
          title: "Shadow senior CSM calls",
          summary: "Join ten customer calls this quarter.",
          scope: "individual",
          weightage: 0,
          dueDate: "2026-12-31",
          intent: "submit"
        })
    },
    {
      name: "employee posts a goal update",
      actor: [AANYA, "employee"],
      run: (c, s) =>
        goals.postGoalUpdate(c, s, {
          goalId: "93939393-9393-4939-8939-939393939393",
          kind: "progress",
          body: "Drafting flow is in review.",
          completionPct: 80
        })
    },
    {
      name: "employee edits a pending goal",
      actor: [AANYA, "employee"],
      run: (c, s) =>
        goals.editGoal(c, s, {
          goalId: "94949494-9494-4949-8949-949494949494",
          title: "Implement reminder escalation workflow v2",
          summary: "Escalate overdue reminders to managers.",
          scope: "individual",
          weightage: 45,
          dueDate: "2026-07-15"
        })
    },
    {
      name: "manager approves a goal",
      actor: [MAYA, "manager"],
      run: (c, s) =>
        goals.resolveGoalApproval(c, s, {
          goalId: "94949494-9494-4949-8949-949494949494",
          intent: "approve",
          weightage: 45,
          notes: "Looks good."
        })
    },
    {
      name: "manager rejects a goal",
      actor: [MAYA, "manager"],
      run: (c, s) =>
        goals.resolveGoalApproval(c, s, {
          goalId: "94949494-9494-4949-8949-949494949494",
          intent: "reject",
          notes: "Please narrow the scope."
        })
    },
    {
      name: "manager reassigns a goal",
      actor: [MAYA, "manager"],
      run: (c, s) =>
        goals.reassignGoalOwner(c, s, {
          goalId: "93939393-9393-4939-8939-939393939393",
          ownerProfileId: ROHAN,
          notes: "Rohan is taking over."
        })
    },
    {
      name: "employee resubmits a draft goal",
      actor: [NEHA, "employee"],
      run: (c, s) =>
        goals.resubmitGoal(c, s, { goalId: "97979797-9797-4979-8979-979797979797" })
    },
    {
      name: "employee archives a draft goal",
      actor: [NEHA, "employee"],
      run: (c, s) =>
        goals.archiveGoal(c, s, { goalId: "97979797-9797-4979-8979-979797979797" })
    },
    {
      name: "admin posts an update on a company goal",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        goals.postGoalUpdate(c, s, {
          goalId: "91919191-9191-4919-8919-919191919191",
          kind: "nudge",
          body: "Please share the latest numbers.",
          completionPct: undefined
        })
    },
    {
      name: "employee cannot touch someone else's goal",
      actor: [ROHAN, "employee"],
      forbidden: true,
      run: (c, s) =>
        goals.archiveGoal(c, s, { goalId: "97979797-9797-4979-8979-979797979797" })
    },
    {
      name: "manager reviews a flag",
      actor: [ARJUN, "manager"],
      run: (c, s) =>
        flags.updateFlagStatus(c, s, {
          flagId: "5555aaaa-6666-4777-8888-9999aaaabbbb",
          status: "under_review",
          notes: "Talking to Neha this week."
        })
    },
    {
      name: "admin resolves a flag",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        flags.updateFlagStatus(c, s, {
          flagId: "4444aaaa-5555-4666-8777-88889999aaaa",
          status: "resolved",
          notes: "Addressed in the day 60 review."
        })
    },
    {
      name: "manager submits probation feedback",
      actor: [ARJUN, "manager"],
      run: (c, s) =>
        probation.submitProbationFeedback(c, s, {
          checkpointId: "d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1",
          score: 4,
          comments: "Steady improvement on account handovers."
        })
    },
    {
      name: "manager submits low probation feedback (raises flags)",
      actor: [ARJUN, "manager"],
      run: (c, s) =>
        probation.submitProbationFeedback(c, s, {
          checkpointId: "d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1",
          score: 1,
          comments: ""
        })
    },
    {
      name: "admin records a probation decision",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        probation.recordProbationDecision(c, s, {
          caseId: "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
          decision: "extend_probation",
          notes: "Extend by 30 days to cover the paused period."
        })
    },
    {
      name: "employee submits a self review",
      actor: [AANYA, "employee"],
      run: (c, s) =>
        reviews.submitReviewSubmission(c, s, {
          cycleId: CYCLE_BIANNUAL,
          profileId: AANYA,
          submissionType: "self_review",
          rating: "meets_expectations",
          comments: "Shipped the drafting flow and onboarding docs."
        })
    },
    {
      name: "manager submits a manager review",
      actor: [MAYA, "manager"],
      run: (c, s) =>
        reviews.submitReviewSubmission(c, s, {
          cycleId: CYCLE_BIANNUAL,
          profileId: AANYA,
          submissionType: "manager_review",
          rating: "above_expectations",
          comments: "Strong ownership of the goals module."
        })
    },
    {
      name: "manager updates discussion status",
      actor: [MAYA, "manager"],
      run: (c, s) =>
        reviews.updateDiscussionStatus(c, s, {
          cycleId: CYCLE_BIANNUAL,
          profileId: AANYA,
          discussionStatus: "completed"
        })
    },
    {
      name: "admin creates a review cycle",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        reviews.createReviewCycle(c, s, {
          label: "Bi-Annual Cycle 2",
          cycleType: "biannual",
          goalWindowLabel: "Jul-Dec 2026",
          triggerDate: "2026-12-01",
          closeDate: "2026-12-31",
          isActive: false
        })
    },
    {
      name: "admin reschedules a review cycle",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        reviews.updateReviewCycleSchedule(c, s, {
          cycleId: CYCLE_QUARTERLY,
          closeDate: "2026-12-20",
          isActive: true
        })
    },
    {
      name: "admin enrolls participants",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        reviews.enrollReviewCycleParticipants(c, s, {
          cycleId: CYCLE_QUARTERLY,
          profileIds: [AANYA, ROHAN]
        })
    },
    {
      name: "admin waives an enrollment",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        reviews.manageReviewEnrollmentAdmin(c, s, {
          cycleId: CYCLE_QUARTERLY,
          profileId: NEHA,
          intent: "waive",
          notes: "On approved leave."
        })
    },
    {
      name: "admin updates settings",
      actor: [ADMIN, "admin"],
      run: (c, s) =>
        admin.updateAdminSettings(c, s, {
          redFlagThreshold: 3,
          goalApprovalEscalationBusinessDays: 4,
          probationEscalationDays: 6,
          secondaryAdminProfileId: MAYA,
          successorAdminProfileId: MAYA
        })
    },
    {
      name: "manager cannot update settings",
      actor: [MAYA, "manager"],
      forbidden: true,
      run: (c, s) =>
        admin.updateAdminSettings(c, s, {
          redFlagThreshold: 9,
          goalApprovalEscalationBusinessDays: 9,
          probationEscalationDays: 9,
          secondaryAdminProfileId: MAYA,
          successorAdminProfileId: MAYA
        })
    }
  ];
}

/** Rows inserted or updated by the current transaction, per table. */
async function touchedRows(client: PoolClient) {
  const tables = await client.query<{ name: string }>(
    "select tablename as name from pg_tables where schemaname = 'public' order by tablename"
  );
  const counts: Record<string, string> = {};

  for (const { name } of tables.rows) {
    const result = await client.query<{ touched: string; total: string }>(
      `select count(*) filter (where xmin::text = (pg_current_xact_id()::text::bigint % 4294967296)::text) as touched,
              count(*) as total
       from public.${name}`
    );
    const row = result.rows[0];

    if (row && row.touched !== "0") {
      counts[name] = `${row.touched} touched / ${row.total} rows`;
    }
  }

  return counts;
}

async function runScenario(scenario: Scenario, enforceRls: boolean) {
  const session = sessionFor(...scenario.actor);
  const pool = getDbPool();
  assert.ok(pool);
  const client = await pool.connect();
  process.env.DB_ENFORCE_RLS = enforceRls ? "true" : "false";
  setAuthUserIdResolverForTests(async () => session.authUserId ?? null);

  try {
    await client.query("begin");

    if (enforceRls) {
      await applyUserContext(client, session.authUserId ?? null);
    }

    let outcome: string;

    try {
      await scenario.run(client, session);
      outcome = "ok";
    } catch (error) {
      // The transaction is aborted, so nothing was written.
      outcome = scenario.forbidden ? "error" : `error: ${error instanceof Error ? error.message : String(error)}`;
      return { outcome, touched: {} };
    }

    await client.query("set local role none");
    return { outcome, touched: await touchedRows(client) };
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe("user actions behave the same with RLS enforced", { skip: !databaseUrl }, () => {
  let scenarios: Scenario[] = [];

  before(async () => {
    scenarios = await loadScenarios();
  });

  after(async () => {
    setAuthUserIdResolverForTests(null);
    await getDbPool()?.end();
  });

  test("every scenario", async () => {
    const mismatches: string[] = [];

    for (const scenario of scenarios) {
      const withoutRls = await runScenario(scenario, false);
      const withRls = await runScenario(scenario, true);

      if (process.env.RLS_DEBUG) {
        console.log(scenario.name, JSON.stringify(withoutRls), JSON.stringify(withRls));
      }

      try {
        assert.deepEqual(withRls, withoutRls);
      } catch {
        mismatches.push(
          `${scenario.name}\n  without RLS: ${JSON.stringify(withoutRls)}\n  with RLS:    ${JSON.stringify(withRls)}`
        );
      }
    }

    assert.equal(mismatches.length, 0, `\n${mismatches.join("\n")}`);
  });
});
