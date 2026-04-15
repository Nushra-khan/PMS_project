import { addDays, isWeekend } from "date-fns";

import { leavePeriods } from "@/lib/demo-data";

function isWithinLeave(profileId: string, date: Date) {
  return leavePeriods.some((period) => {
    if (period.profileId !== profileId) {
      return false;
    }

    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    return date >= start && date <= end;
  });
}

export function isWorkingDay(profileId: string, date: Date) {
  return !isWeekend(date) && !isWithinLeave(profileId, date);
}

export function addWorkingDaysForProfile(
  profileId: string,
  startDate: string,
  daysToAdd: number
) {
  let cursor = new Date(startDate);
  let added = 0;

  while (added < daysToAdd) {
    cursor = addDays(cursor, 1);

    if (isWorkingDay(profileId, cursor)) {
      added += 1;
    }
  }

  return cursor;
}
