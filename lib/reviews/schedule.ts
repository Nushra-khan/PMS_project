export type CycleType = "biannual" | "quarterly";

export type StandardCycle = {
  cycleType: CycleType;
  label: string;
  goalWindowLabel: string;
  triggerDate: string;
  closeDate: string;
  finalizeFrom?: string;
};

export type ReminderStage = "nudge" | "urgent" | "escalation";

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * The standard cycles from the product plan that trigger in `year`:
 * bi-annual Feb 1 and Aug 1 (close the 25th, finalize from the 26th), and
 * quarterly Jan 1, Apr 1, Jul 1 and Oct 1 (close the 15th).
 */
export function standardCyclesForYear(year: number): StandardCycle[] {
  return [
    {
      cycleType: "biannual",
      label: `Bi-Annual ${year - 1}-${String(year).slice(2)} H2`,
      goalWindowLabel: `Oct ${year - 1} - Mar ${year}`,
      triggerDate: iso(year, 2, 1),
      closeDate: iso(year, 2, 25),
      finalizeFrom: iso(year, 2, 26)
    },
    {
      cycleType: "biannual",
      label: `Bi-Annual ${year} H1`,
      goalWindowLabel: `Apr - Sep ${year}`,
      triggerDate: iso(year, 8, 1),
      closeDate: iso(year, 8, 25),
      finalizeFrom: iso(year, 8, 26)
    },
    ...[
      { quarter: 4, reviewYear: year - 1, month: 1, window: `Oct - Dec ${year - 1}` },
      { quarter: 1, reviewYear: year, month: 4, window: `Jan - Mar ${year}` },
      { quarter: 2, reviewYear: year, month: 7, window: `Apr - Jun ${year}` },
      { quarter: 3, reviewYear: year, month: 10, window: `Jul - Sep ${year}` }
    ].map((entry) => ({
      cycleType: "quarterly" as const,
      label: `Quarterly Q${entry.quarter} ${entry.reviewYear}`,
      goalWindowLabel: entry.window,
      triggerDate: iso(year, entry.month, 1),
      closeDate: iso(year, entry.month, 15)
    }))
  ];
}

/** Standard cycles that trigger within `daysAhead` days of `today` (inclusive). */
export function upcomingStandardCycles(today: string, daysAhead: number) {
  const start = new Date(`${today}T00:00:00Z`).getTime();
  const end = start + daysAhead * 24 * 60 * 60 * 1000;
  const year = new Date(start).getUTCFullYear();

  return [...standardCyclesForYear(year), ...standardCyclesForYear(year + 1)].filter((cycle) => {
    const trigger = new Date(`${cycle.triggerDate}T00:00:00Z`).getTime();
    return trigger >= start && trigger <= end;
  });
}

/**
 * Reminders go out on the 5th, 15th and 22nd day of a cycle (counting the
 * trigger date as day 1): a gentle nudge, an urgent reminder, then an
 * escalation to Admin. Returns the latest stage reached, or null.
 */
export function reminderStageFor(triggerDate: string, today: string): ReminderStage | null {
  const day =
    Math.round(
      (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${triggerDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1;

  if (day >= 22) return "escalation";
  if (day >= 15) return "urgent";
  if (day >= 5) return "nudge";
  return null;
}

/** People must join more than 60 days before a cycle closes to be reviewed in it. */
export function isEligibleForCycle(dateOfJoining: string, closeDate: string) {
  const joined = new Date(`${dateOfJoining}T00:00:00Z`).getTime();
  const close = new Date(`${closeDate}T00:00:00Z`).getTime();
  return close - joined > 60 * 24 * 60 * 60 * 1000;
}
