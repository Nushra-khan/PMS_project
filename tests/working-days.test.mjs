import assert from "node:assert/strict";
import { test } from "node:test";

import { addWorkingDays, isWorkingDay } from "../lib/dates/working-days.ts";

const day = (value) => addWorkingDays(value, 0).toISOString().slice(0, 10);

test("weekends are not working days", () => {
  assert.equal(isWorkingDay(new Date("2026-11-28")), false); // Saturday
  assert.equal(isWorkingDay(new Date("2026-11-29")), false); // Sunday
  assert.equal(isWorkingDay(new Date("2026-11-30")), true); // Monday
});

test("adding working days skips weekends", () => {
  // Friday + 1 working day = Monday
  assert.equal(addWorkingDays("2026-11-27", 1).toISOString().slice(0, 10), "2026-11-30");
  assert.equal(day("2026-11-27"), "2026-11-27");
});

test("leave periods push the deadline out", () => {
  const leave = [{ startDate: "2026-11-30", endDate: "2026-12-01" }];
  assert.equal(
    addWorkingDays("2026-11-27", 1, leave).toISOString().slice(0, 10),
    "2026-12-02"
  );
});
