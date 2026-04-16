import { addDays, isWeekend } from "date-fns";

import { leavePeriods } from "@/lib/demo-data";

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

function getDemoLeavePeriods(profileId: string) {
  return leavePeriods
    .filter((period) => period.profileId === profileId)
    .map((period) => ({
      startDate: period.startDate,
      endDate: period.endDate
    }));
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

export function isWorkingDayForProfile(profileId: string, date: Date) {
  return isWorkingDay(date, getDemoLeavePeriods(profileId));
}

export function addWorkingDaysForProfile(
  profileId: string,
  startDate: string,
  daysToAdd: number
) {
  return addWorkingDays(startDate, daysToAdd, getDemoLeavePeriods(profileId));
}
