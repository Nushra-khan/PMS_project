import { differenceInCalendarDays } from "date-fns";

import { demoWorkspace, profiles } from "@/lib/demo-data";
import { AppSession, Role } from "@/lib/types";

function sessionProfileId(session: AppSession) {
  return session.workspaceProfileId;
}

function getTeamMemberIds(managerId: string) {
  return profiles
    .filter((profile) => profile.managerId === managerId)
    .map((profile) => profile.id);
}

export function getAccessibleGoals(session: AppSession) {
  if (session.role === "admin") {
    return demoWorkspace.goals;
  }

  if (session.role === "manager") {
    const managerId = sessionProfileId(session);
    const teamIds = new Set([managerId, ...getTeamMemberIds(managerId)]);
    return demoWorkspace.goals.filter(
      (goal) => goal.scope === "company" || teamIds.has(goal.ownerProfileId)
    );
  }

  return demoWorkspace.goals.filter(
    (goal) => goal.scope === "company" || goal.ownerProfileId === sessionProfileId(session)
  );
}

export function getPendingApprovals(session: AppSession) {
  const teamMemberIds = new Set(getTeamMemberIds(sessionProfileId(session)));

  return demoWorkspace.goals.filter((goal) => {
    if (goal.status !== "pending_approval" && goal.status !== "draft") {
      return false;
    }

    if (session.role === "admin") {
      return true;
    }

    return teamMemberIds.has(goal.ownerProfileId);
  });
}

export function getProbationCases(session: AppSession) {
  if (session.role === "admin") {
    return demoWorkspace.probationCases;
  }

  if (session.role === "manager") {
    return demoWorkspace.probationCases.filter(
      (probationCase) => probationCase.managerProfileId === sessionProfileId(session)
    );
  }

  return demoWorkspace.probationCases.filter(
    (probationCase) => probationCase.profileId === sessionProfileId(session)
  );
}

export function getAccessibleFlags(session: AppSession) {
  if (session.role === "admin") {
    return demoWorkspace.flags;
  }

  if (session.role === "manager") {
    const teamIds = new Set(getTeamMemberIds(sessionProfileId(session)));
    return demoWorkspace.flags.filter((flag) => teamIds.has(flag.employeeProfileId));
  }

  return demoWorkspace.flags.filter(
    (flag) => flag.employeeProfileId === sessionProfileId(session)
  );
}

export function getAccessibleCycles(session: AppSession) {
  if (session.role === "admin") {
    return demoWorkspace.reviewCycles;
  }

  const currentProfileId = sessionProfileId(session);
  const teamIds = new Set(getTeamMemberIds(currentProfileId));
  const cycleIds = new Set(
    demoWorkspace.cycleEnrollments
      .filter((enrollment) => {
        if (session.role === "manager") {
          return (
            enrollment.managerProfileId === currentProfileId ||
            teamIds.has(enrollment.profileId) ||
            enrollment.profileId === currentProfileId
          );
        }

        return enrollment.profileId === currentProfileId;
      })
      .map((enrollment) => enrollment.cycleId)
  );

  return demoWorkspace.reviewCycles.filter((cycle) => cycleIds.has(cycle.id));
}

export function getDashboardStats(session: AppSession) {
  const goals = getAccessibleGoals(session);
  const pendingApprovals = getPendingApprovals(session);
  const probationCases = getProbationCases(session);
  const flags = getAccessibleFlags(session);
  const cycles = getAccessibleCycles(session);

  const totalGoalProgress =
    goals.length === 0
      ? 0
      : Math.round(
          goals.reduce((total, goal) => total + goal.completionPct, 0) / goals.length
        );

  return [
    {
      label: session.role === "employee" ? "My active goals" : "Active goals in view",
      value: String(goals.filter((goal) => goal.status === "active").length),
      description: `${totalGoalProgress}% average completion across accessible goals.`
    },
    {
      label: "Pending approvals",
      value: String(pendingApprovals.length),
      description: `Escalation target: ${demoWorkspace.appSettings.goalApprovalEscalationBusinessDays} business days.`
    },
    {
      label: "Probation cases",
      value: String(probationCases.length),
      description: `${probationCases.filter((item) => item.status !== "completed").length} still need active monitoring.`
    },
    {
      label: "Open flags",
      value: String(flags.filter((flag) => flag.status !== "resolved").length),
      description: `${cycles.length} review cycle(s) currently visible in this workspace.`
    }
  ];
}

export function getGoalHealth(session: AppSession) {
  return getAccessibleGoals(session).map((goal) => ({
    ...goal,
    daysLeft: differenceInCalendarDays(new Date(goal.dueDate), new Date("2026-04-16"))
  }));
}

export function getHomeFeed(session: AppSession) {
  return demoWorkspace.notifications.filter(
    (notification) =>
      notification.audienceRole === session.role ||
      notification.audienceRole === "employee"
  );
}

export function getRecentAuditTrail(session: AppSession) {
  if (session.role === "admin") {
    return demoWorkspace.auditLogs;
  }

  return demoWorkspace.auditLogs.filter(
    (log) =>
      log.actorProfileId === sessionProfileId(session) ||
      log.summary.includes(session.profile.name)
  );
}

export function getCycleById(cycleId: string) {
  return demoWorkspace.reviewCycles.find((cycle) => cycle.id === cycleId);
}

export function getCycleEnrollments(cycleId: string) {
  return demoWorkspace.cycleEnrollments.filter((enrollment) => enrollment.cycleId === cycleId);
}

export function getRoleLabel(role: Role) {
  if (role === "admin") {
    return "Admin (HR)";
  }

  if (role === "manager") {
    return "Manager";
  }

  return "Employee";
}
