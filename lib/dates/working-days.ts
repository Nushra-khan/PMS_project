export type WorkingDayLeavePeriod = {
  startDate: string;
  endDate: string;
};

function isWithinLeave(date: Date, periods: WorkingDayLeavePeriod[]) {
  return periods.some((period) => {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    return date >= start && date <= end;
  });
}

// Dates are parsed from "YYYY-MM-DD" strings, which JavaScript treats as UTC
// midnight. Use UTC getters so the weekday does not shift with the server's
// local time zone.
function isWeekendUtc(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isWorkingDay(date: Date, periods: WorkingDayLeavePeriod[] = []) {
  return !isWeekendUtc(date) && !isWithinLeave(date, periods);
}

export function addWorkingDays(
  startDate: string,
  daysToAdd: number,
  periods: WorkingDayLeavePeriod[] = []
) {
  let cursor = new Date(startDate);
  let added = 0;

  while (added < daysToAdd) {
    cursor = addUtcDays(cursor, 1);

    if (isWorkingDay(cursor, periods)) {
      added += 1;
    }
  }

  return cursor;
}
