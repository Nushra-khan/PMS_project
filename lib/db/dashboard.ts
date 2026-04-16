import { differenceInCalendarDays } from "date-fns";

import { runWithClient, toDateString } from "@/lib/db/helpers";
import { GoalRecord, getGoalApprovalPageData, getGoalPageData } from "@/lib/db/goals";
import { getFlagPageDataCount } from "@/lib/db/flags";
import { getProbationCaseCount } from "@/lib/db/probation";
import { getReviewCycleCount } from "@/lib/db/reviews";
import { AppSession, AuditLog, NotificationItem } from "@/lib/types";

type DashboardStat = {
  label: string;
  value: string;
  description: string;
};

type NotificationRecord = NotificationItem;

type AuditLogRecord = AuditLog & {
  actorName: string;
};

export type DashboardPageData = {
  stats: DashboardStat[];
  goals: Array<GoalRecord & { daysLeft: number }>;
  notifications: NotificationRecord[];
  auditTrail: AuditLogRecord[];
};

async function getNotifications(session: AppSession) {
  return runWithClient<NotificationRecord[]>([], async (client) => {
    const roles = Array.from(
      new Set(session.profile.roles.length > 0 ? session.profile.roles : [session.role])
    );
    const result = await client.query<{
      id: string;
      audience_role: NotificationItem["audienceRole"];
      title: string;
      body: string;
      status: NotificationItem["status"];
      sent_at: string | Date | null;
    }>(
      `
        select id, audience_role, title, body, status, sent_at
        from public.notifications
        where audience_role = any($1::app_role[])
        order by created_at desc
        limit 8
      `,
      [roles]
    );

    return result.rows.map((row) => ({
      id: row.id,
      audienceRole: row.audience_role,
      title: row.title,
      body: row.body,
      status: row.status,
      sentAt: toDateString(row.sent_at)
    }));
  });
}

async function getAuditTrail(session: AppSession) {
  return runWithClient<AuditLogRecord[]>([], async (client) => {
    const result =
      session.role === "admin"
        ? await client.query<{
            id: string;
            actor_profile_id: string;
            entity_type: string;
            entity_id: string | null;
            action: string;
            created_at: string | Date;
            summary: string;
            actor_name: string;
          }>(
            `
              select
                logs.id,
                logs.actor_profile_id,
                logs.entity_type,
                logs.entity_id,
                logs.action,
                logs.created_at,
                logs.summary,
                actor.full_name as actor_name
              from public.audit_logs logs
              join public.profiles actor on actor.id = logs.actor_profile_id
              order by logs.created_at desc
              limit 12
            `
          )
        : await client.query<{
            id: string;
            actor_profile_id: string;
            entity_type: string;
            entity_id: string | null;
            action: string;
            created_at: string | Date;
            summary: string;
            actor_name: string;
          }>(
            `
              select
                logs.id,
                logs.actor_profile_id,
                logs.entity_type,
                logs.entity_id,
                logs.action,
                logs.created_at,
                logs.summary,
                actor.full_name as actor_name
              from public.audit_logs logs
              join public.profiles actor on actor.id = logs.actor_profile_id
              where logs.actor_profile_id = $1
              order by logs.created_at desc
              limit 12
            `,
            [session.userId]
          );

    return result.rows.map((row) => ({
      id: row.id,
      actorProfileId: row.actor_profile_id,
      entityType: row.entity_type,
      entityId: row.entity_id ?? "",
      action: row.action,
      createdAt: toDateString(row.created_at) ?? "",
      summary: row.summary,
      actorName: row.actor_name
    }));
  });
}

async function getGoalApprovalEscalationBusinessDays() {
  return runWithClient<number>(5, async (client) => {
    const result = await client.query<{ goal_approval_escalation_business_days: number }>(
      `
        select goal_approval_escalation_business_days
        from public.app_settings
        where singleton = true
        limit 1
      `
    );

    return result.rows[0]?.goal_approval_escalation_business_days ?? 5;
  });
}

export async function getDashboardPageData(session: AppSession): Promise<DashboardPageData> {
  const [{ goals }, { pendingApprovals }, notifications, auditTrail, probationCount, flagCount, cycleCount, escalationDays] =
    await Promise.all([
      getGoalPageData(session),
      getGoalApprovalPageData(session),
      getNotifications(session),
      getAuditTrail(session),
      getProbationCaseCount(session),
      getFlagPageDataCount(session),
      getReviewCycleCount(session),
      getGoalApprovalEscalationBusinessDays()
    ]);

  const goalsWithHealth = goals.map((goal) => ({
    ...goal,
    daysLeft: differenceInCalendarDays(new Date(goal.dueDate), new Date())
  }));
  const totalGoalProgress =
    goals.length === 0
      ? 0
      : Math.round(goals.reduce((total, goal) => total + goal.completionPct, 0) / goals.length);

  return {
    stats: [
      {
        label: session.role === "employee" ? "My active goals" : "Active goals in view",
        value: String(goals.filter((goal) => goal.status === "active").length),
        description: `${totalGoalProgress}% average completion across accessible goals.`
      },
      {
        label: "Pending approvals",
        value: String(pendingApprovals.length),
        description: `Escalation target: ${escalationDays} business days.`
      },
      {
        label: "Probation cases",
        value: String(probationCount.total),
        description: `${probationCount.active} still need active monitoring.`
      },
      {
        label: "Open flags",
        value: String(flagCount.open),
        description: `${cycleCount} review cycle(s) currently visible in this workspace.`
      }
    ],
    goals: goalsWithHealth,
    notifications,
    auditTrail
  };
}
