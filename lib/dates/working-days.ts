import { addDays, isWeekend } from "date-fns";

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

export function isWorkingDay(date: Date, periods: WorkingDayLeavePeriod[] = []) {
  return !isWeekend(date) && !isWithinLeave(date, periods);
}

export function addWorkingDays(
  startDate: string,
  daysToAdd: number,
  periods: WorkingDayLeavePeriod[] = []
) {
  let cursor = new Date(startDate);
  let added = 0;

  while (added < daysToAdd) {
    cursor = addDays(cursor, 1);

    if (isWorkingDay(cursor, periods)) {
      added += 1;
    }
  }

  return cursor;
}
