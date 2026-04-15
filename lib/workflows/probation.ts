import { demoWorkspace, profiles } from "@/lib/demo-data";
import { addWorkingDaysForProfile } from "@/lib/dates/working-days";

export function getProbationTimeline(profileId: string) {
  const profile = profiles.find((entry) => entry.id === profileId);

  if (!profile) {
    return [];
  }

  return [
    {
      label: "Day 30",
      date: addWorkingDaysForProfile(profileId, profile.dateOfJoining, 30),
      description: "Initial check-in with paired employee and manager forms."
    },
    {
      label: "Day 60",
      date: addWorkingDaysForProfile(profileId, profile.dateOfJoining, 60),
      description: "Mid-probation review with reminder tracking and escalation."
    },
    {
      label: "Day 80",
      date: addWorkingDaysForProfile(profileId, profile.dateOfJoining, 80),
      description: "Final pre-confirmation review and manager briefing prep."
    }
  ];
}

export function getCheckpointsForCase(caseId: string) {
  return demoWorkspace.probationCheckpoints.filter(
    (checkpoint) => checkpoint.caseId === caseId
  );
}
