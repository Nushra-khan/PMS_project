/**
 * Compares every page read with RLS off and on, for an admin, a manager, a
 * manager who is also an employee, and two employees. With correct policies
 * both runs return the same data. Needs TEST_DATABASE_URL pointing at a
 * disposable database loaded by scripts/sql/setup-test-db.sh.
 */
import "./test-env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { setAuthUserIdResolverForTests } from "@/lib/auth/current-user";
import { getDbPool } from "@/lib/db/pool";
import type { AppSession, Role } from "@/lib/types";

const databaseUrl = process.env.TEST_DATABASE_URL;

const people: Array<{ name: string; profileId: string; role: Role }> = [
  { name: "admin", profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", role: "admin" },
  { name: "manager", profileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", role: "manager" },
  { name: "second manager", profileId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", role: "manager" },
  { name: "employee", profileId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1", role: "employee" },
  { name: "probation employee", profileId: "ffffffff-ffff-4fff-8fff-fffffffffff1", role: "employee" }
];

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

type Reader = (session: AppSession) => Promise<unknown>;

async function loadReaders(): Promise<Record<string, Reader>> {
  const dashboard = await import("@/lib/db/dashboard");
  const goals = await import("@/lib/db/goals");
  const flags = await import("@/lib/db/flags");
  const probation = await import("@/lib/db/probation");
  const reports = await import("@/lib/db/reports");
  const reviews = await import("@/lib/db/reviews");
  const people = await import("@/lib/db/people");
  const trends = await import("@/lib/db/trends");

  return {
    dashboard: dashboard.getDashboardPageData,
    goals: goals.getGoalPageData,
    goalComposer: goals.getGoalComposerData,
    goalApprovals: goals.getGoalApprovalPageData,
    goalOwners: goals.getGoalOwnerOptions,
    flags: flags.getFlagsPageData,
    probation: probation.getProbationPageData,
    reports: reports.getReportsPageData,
    reviews: reviews.getReviewsPageData,
    trends: trends.getDashboardTrends,
    people: (s) => (s.role === "admin" ? people.getPeoplePageData() : Promise.resolve(null)),
    exportGoals: (s) => reports.getReportExport(s, "goals"),
    exportReviews: (s) => reports.getReportExport(s, "reviews"),
    exportProbation: (s) => reports.getReportExport(s, "probation"),
    exportFlags: (s) => reports.getReportExport(s, "flags"),
    exportAudit: (s) => reports.getReportExport(s, "audit")
  };
}

async function readWithRls(enforced: boolean, reader: Reader, session: AppSession) {
  process.env.DB_ENFORCE_RLS = enforced ? "true" : "false";
  setAuthUserIdResolverForTests(async () => session.authUserId ?? null);
  // Round-trip through JSON so Dates compare by value.
  return JSON.parse(JSON.stringify(await reader(session)));
}

describe("page reads return the same data with RLS enforced", { skip: !databaseUrl }, () => {
  let readers: Record<string, Reader>;

  before(async () => {
    readers = await loadReaders();

    // Some reads run workflow automation first (probation sync, goal
    // escalations). Run everything once so both compared runs see the same data.
    for (const person of people) {
      for (const reader of Object.values(readers)) {
        await readWithRls(false, reader, sessionFor(person.profileId, person.role));
      }
    }
  });

  after(async () => {
    setAuthUserIdResolverForTests(null);
    await getDbPool()?.end();
  });

  for (const person of people) {
    test(person.name, async () => {
      const session = sessionFor(person.profileId, person.role);

      const mismatches: string[] = [];

      for (const [name, reader] of Object.entries(readers)) {
        const withoutRls = await readWithRls(false, reader, session);
        const withRls = await readWithRls(true, reader, session);

        try {
          assert.deepEqual(withRls, withoutRls);
        } catch (error) {
          mismatches.push(name);
          if (process.env.RLS_DEBUG) console.log(`${person.name} / ${name}:`, String(error).slice(0, 1500));
        }
      }

      assert.deepEqual(mismatches, [], `reads that change under RLS for ${person.name}`);
    });
  }
});
