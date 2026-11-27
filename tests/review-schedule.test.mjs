import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEligibleForCycle,
  reminderStageFor,
  standardCyclesForYear,
  upcomingStandardCycles
} from "../lib/reviews/schedule.ts";

test("standard cycles follow the plan's dates", () => {
  const cycles = standardCyclesForYear(2027);
  const biannual = cycles.filter((cycle) => cycle.cycleType === "biannual");
  assert.deepEqual(
    biannual.map((cycle) => [cycle.triggerDate, cycle.closeDate, cycle.finalizeFrom]),
    [
      ["2027-02-01", "2027-02-25", "2027-02-26"],
      ["2027-08-01", "2027-08-25", "2027-08-26"]
    ]
  );
  const quarterly = cycles.filter((cycle) => cycle.cycleType === "quarterly");
  assert.deepEqual(
    quarterly.map((cycle) => cycle.triggerDate),
    ["2027-01-01", "2027-04-01", "2027-07-01", "2027-10-01"]
  );
  assert.equal(quarterly[0].label, "Quarterly Q4 2026");
});

test("upcoming cycles look across the year boundary", () => {
  const upcoming = upcomingStandardCycles("2026-12-15", 30);
  assert.deepEqual(upcoming.map((cycle) => cycle.label), ["Quarterly Q4 2026"]);
});

test("reminders land on the 5th, 15th and 22nd", () => {
  assert.equal(reminderStageFor("2026-08-01", "2026-08-04"), null);
  assert.equal(reminderStageFor("2026-08-01", "2026-08-05"), "nudge");
  assert.equal(reminderStageFor("2026-08-01", "2026-08-14"), "nudge");
  assert.equal(reminderStageFor("2026-08-01", "2026-08-15"), "urgent");
  assert.equal(reminderStageFor("2026-08-01", "2026-08-22"), "escalation");
});

test("joiners within 60 days of close are not eligible", () => {
  assert.equal(isEligibleForCycle("2026-05-01", "2026-08-25"), true);
  assert.equal(isEligibleForCycle("2026-07-01", "2026-08-25"), false);
});
