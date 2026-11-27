import assert from "node:assert/strict";
import { test } from "node:test";

import { computeGoalRollups } from "../lib/goals/rollup.ts";

const goal = (id, parentGoalId, weightage, completionPct, status = "active") => ({
  id,
  parentGoalId,
  weightage,
  completionPct,
  status
});

test("weights children by weightage", () => {
  const rollups = computeGoalRollups([
    goal("team", undefined, 100, 0),
    goal("a", "team", 75, 100),
    goal("b", "team", 25, 0)
  ]);
  assert.deepEqual(rollups.get("team"), { completionPct: 75, childCount: 2 });
  assert.equal(rollups.has("a"), false);
});

test("rolls up through company, team and individual", () => {
  const rollups = computeGoalRollups([
    goal("company", undefined, 100, 0),
    goal("team-1", "company", 50, 0),
    goal("team-2", "company", 50, 40),
    goal("ind-1", "team-1", 100, 80)
  ]);
  assert.equal(rollups.get("team-1").completionPct, 80);
  assert.equal(rollups.get("company").completionPct, 60);
});

test("uses equal weights when every child has weightage 0", () => {
  const rollups = computeGoalRollups([
    goal("team", undefined, 100, 0),
    goal("a", "team", 0, 30),
    goal("b", "team", 0, 70)
  ]);
  assert.equal(rollups.get("team").completionPct, 50);
});

test("ignores draft and archived children", () => {
  const rollups = computeGoalRollups([
    goal("team", undefined, 100, 0),
    goal("a", "team", 50, 40),
    goal("b", "team", 50, 100, "draft"),
    goal("c", "team", 50, 100, "archived")
  ]);
  assert.deepEqual(rollups.get("team"), { completionPct: 40, childCount: 1 });
});

test("survives a cycle in bad data", () => {
  const rollups = computeGoalRollups([goal("a", "b", 50, 10), goal("b", "a", 50, 90)]);
  assert.ok(rollups.get("a").completionPct >= 0);
});
