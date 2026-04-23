import { PoolClient } from "pg";

import { runWithClient, getDirectReportIds, toDateOnly, toDateString, toNumber } from "@/lib/db/helpers";
import { AppSession, FlagSeverity, FlagStatus, GoalStatus, ProbationStatus, RatingValue, ReviewStatus } from "@/lib/types";

export const reportDatasets = ["goals", "reviews", "probation", "flags", "audit"] as const;

export type ReportDataset = (typeof reportDatasets)[number];

type ReportStat = {
  label: string;
  value: string;
  description: string;
};

export type GoalReportRow = {
  title: string;
  ownerName: string;
  scope: string;
  status: GoalStatus;
  weightage: number;
  completionPct: number;
  dueDate: string;
};

export type ReviewReportRow = {
  cycleLabel: string;
  employeeName: string;
  managerName: string;
  reviewStatus: ReviewStatus;
  discussionStatus: string;
  finalRating?: RatingValue;
};

export type ProbationReportRow = {
  employeeName: string;
  managerName: string;
  status: ProbationStatus;
  confirmationCallDate?: string;
  checkpointsTotal: number;
  checkpointsShared: number;
};

export type FlagReportRow = {
  employeeName: string;
  severity: FlagSeverity;
  status: FlagStatus;
  reason: string;
  agedAt: string;
};

export type AuditReportRow = {
  actorName: string;
  entityType: string;
  action: string;
  summary: string;
  createdAt: string;
};

export type ReportsPageData = {
  stats: ReportStat[];
  goals: GoalReportRow[];
  reviews: ReviewReportRow[];
  probation: ProbationReportRow[];
  flags: FlagReportRow[];
  audit: AuditReportRow[];
};

export function isReportDataset(value: string): value is ReportDataset {
  return reportDatasets.includes(value as ReportDataset);
}

async function getAccessibleProfileIds(
  client: PoolClient,
  session: AppSession
) {
  if (session.role === "admin") {
    return null;
  }

  if (session.role === "manager") {
    return [session.userId, ...(await getDirectReportIds(client, session.userId))];
  }

  return [session.userId];
}

function csvEscape(value: string | number | undefined) {
  const normalized = value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
}

function toCsv(headers: string[], rows: Array<Array<string | number | undefined>>) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(","))
  ].join("\n");
}

export async function getReportsPageData(session: AppSession): Promise<ReportsPageData> {
  return runWithClient<ReportsPageData>(
    {
      stats: [],
      goals: [],
      reviews: [],
      probation: [],
      flags: [],
      audit: []
    },
    async (client) => {
      const accessibleProfileIds = await getAccessibleProfileIds(client, session);

      const [
        goalsResult,
        reviewsResult,
        probationResult,
        flagsResult,
        auditResult
      ] = await Promise.all([
        client.query<{
          title: string;
          owner_name: string;
          scope: string;
          status: GoalStatus;
          weightage: string | number;
          completion_pct: string | number;
          due_date: string | Date;
        }>(
          `
            select
              goals.title,
              owner.full_name as owner_name,
              goals.scope,
              goals.status,
              goals.weightage,
              goals.completion_pct,
              goals.due_date
            from public.goals goals
            join public.profiles owner on owner.id = goals.owner_profile_id
            where ($1::uuid[] is null or goals.scope = 'company' or goals.owner_profile_id = any($1::uuid[]))
            order by goals.due_date asc, goals.created_at desc
          `,
          [accessibleProfileIds]
        ),
        client.query<{
          cycle_label: string;
          employee_name: string;
          manager_name: string;
          review_status: ReviewStatus;
          discussion_status: string;
          final_rating: RatingValue | null;
        }>(
          `
            select
              cycles.label as cycle_label,
              employee.full_name as employee_name,
              manager.full_name as manager_name,
              enrollments.review_status,
              enrollments.discussion_status,
              enrollments.final_rating
            from public.cycle_enrollments enrollments
            join public.review_cycles cycles on cycles.id = enrollments.cycle_id
            join public.profiles employee on employee.id = enrollments.profile_id
            join public.profiles manager on manager.id = enrollments.manager_profile_id
            where ($1::uuid[] is null or enrollments.profile_id = any($1::uuid[]))
            order by cycles.trigger_date desc, employee.full_name asc
          `,
          [accessibleProfileIds]
        ),
        client.query<{
          employee_name: string;
          manager_name: string | null;
          status: ProbationStatus;
          confirmation_call_date: string | Date | null;
          checkpoints_total: string | number;
          checkpoints_shared: string | number;
        }>(
          `
            select
              employee.full_name as employee_name,
              manager.full_name as manager_name,
              cases.status,
              cases.confirmation_call_date,
              count(checkpoints.id) as checkpoints_total,
              count(checkpoints.id) filter (where checkpoints.status = 'shared') as checkpoints_shared
            from public.probation_cases cases
            join public.profiles employee on employee.id = cases.profile_id
            left join public.profiles manager on manager.id = cases.manager_profile_id
            left join public.probation_checkpoints checkpoints on checkpoints.probation_case_id = cases.id
            where (
              $1::uuid[] is null
              or cases.profile_id = any($1::uuid[])
              or cases.manager_profile_id = any($1::uuid[])
            )
            group by employee.full_name, manager.full_name, cases.status, cases.confirmation_call_date
            order by cases.confirmation_call_date asc nulls last, employee.full_name asc
          `,
          [accessibleProfileIds]
        ),
        client.query<{
          employee_name: string;
          severity: FlagSeverity;
          status: FlagStatus;
          reason: string;
          aged_at: string | Date;
        }>(
          `
            select
              employee.full_name as employee_name,
              flags.severity,
              flags.status,
              flags.reason,
              flags.aged_at
            from public.flags flags
            join public.profiles employee on employee.id = flags.employee_profile_id
            where ($1::uuid[] is null or flags.employee_profile_id = any($1::uuid[]))
            order by flags.aged_at desc
          `,
          [accessibleProfileIds]
        ),
        session.role === "admin"
          ? client.query<{
              actor_name: string;
              entity_type: string;
              action: string;
              summary: string;
              created_at: string | Date;
            }>(
              `
                select
                  actor.full_name as actor_name,
                  logs.entity_type,
                  logs.action,
                  logs.summary,
                  logs.created_at
                from public.audit_logs logs
                join public.profiles actor on actor.id = logs.actor_profile_id
                order by logs.created_at desc
                limit 100
              `
            )
          : client.query<{
              actor_name: string;
              entity_type: string;
              action: string;
              summary: string;
              created_at: string | Date;
            }>(
              `
                select
                  actor.full_name as actor_name,
                  logs.entity_type,
                  logs.action,
                  logs.summary,
                  logs.created_at
                from public.audit_logs logs
                join public.profiles actor on actor.id = logs.actor_profile_id
                where logs.actor_profile_id = $1
                order by logs.created_at desc
                limit 100
              `,
              [session.userId]
            )
      ]);

      const goals = goalsResult.rows.map((row) => ({
        title: row.title,
        ownerName: row.owner_name,
        scope: row.scope,
        status: row.status,
        weightage: toNumber(row.weightage),
        completionPct: toNumber(row.completion_pct),
        dueDate: toDateOnly(row.due_date) ?? ""
      }));
      const reviews = reviewsResult.rows.map((row) => ({
        cycleLabel: row.cycle_label,
        employeeName: row.employee_name,
        managerName: row.manager_name,
        reviewStatus: row.review_status,
        discussionStatus: row.discussion_status,
        finalRating: row.final_rating ?? undefined
      }));
      const probation = probationResult.rows.map((row) => ({
        employeeName: row.employee_name,
        managerName: row.manager_name ?? "Unassigned",
        status: row.status,
        confirmationCallDate: toDateOnly(row.confirmation_call_date),
        checkpointsTotal: toNumber(row.checkpoints_total),
        checkpointsShared: toNumber(row.checkpoints_shared)
      }));
      const flags = flagsResult.rows.map((row) => ({
        employeeName: row.employee_name,
        severity: row.severity,
        status: row.status,
        reason: row.reason,
        agedAt: toDateString(row.aged_at) ?? ""
      }));
      const audit = auditResult.rows.map((row) => ({
        actorName: row.actor_name,
        entityType: row.entity_type,
        action: row.action,
        summary: row.summary,
        createdAt: toDateString(row.created_at) ?? ""
      }));

      return {
        stats: [
          {
            label: "Active goals",
            value: String(goals.filter((goal) => goal.status === "active").length),
            description: `${goals.length} goal record(s) included in this report scope.`
          },
          {
            label: "Finalized reviews",
            value: String(reviews.filter((review) => review.reviewStatus === "finalized").length),
            description: `${reviews.length} review enrollment(s) visible.`
          },
          {
            label: "Active probation",
            value: String(probation.filter((entry) => entry.status === "active").length),
            description: `${probation.length} probation case(s) in the export scope.`
          },
          {
            label: "Open flags",
            value: String(flags.filter((flag) => flag.status !== "resolved").length),
            description: `${flags.length} flag record(s) available for review.`
          }
        ],
        goals,
        reviews,
        probation,
        flags,
        audit
      };
    }
  );
}

export async function getReportExport(session: AppSession, dataset: ReportDataset) {
  const data = await getReportsPageData(session);
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (dataset === "goals") {
    return {
      filename: `pms-goals-${dateStamp}.csv`,
      csv: toCsv(
        ["Title", "Owner", "Scope", "Status", "Weightage", "Completion", "Due date"],
        data.goals.map((row) => [
          row.title,
          row.ownerName,
          row.scope,
          row.status,
          row.weightage,
          row.completionPct,
          row.dueDate
        ])
      )
    };
  }

  if (dataset === "reviews") {
    return {
      filename: `pms-reviews-${dateStamp}.csv`,
      csv: toCsv(
        ["Cycle", "Employee", "Manager", "Review status", "Discussion", "Final rating"],
        data.reviews.map((row) => [
          row.cycleLabel,
          row.employeeName,
          row.managerName,
          row.reviewStatus,
          row.discussionStatus,
          row.finalRating
        ])
      )
    };
  }

  if (dataset === "probation") {
    return {
      filename: `pms-probation-${dateStamp}.csv`,
      csv: toCsv(
        ["Employee", "Manager", "Status", "Confirmation call", "Checkpoints", "Shared"],
        data.probation.map((row) => [
          row.employeeName,
          row.managerName,
          row.status,
          row.confirmationCallDate,
          row.checkpointsTotal,
          row.checkpointsShared
        ])
      )
    };
  }

  if (dataset === "flags") {
    return {
      filename: `pms-flags-${dateStamp}.csv`,
      csv: toCsv(
        ["Employee", "Severity", "Status", "Reason", "Aged at"],
        data.flags.map((row) => [
          row.employeeName,
          row.severity,
          row.status,
          row.reason,
          row.agedAt
        ])
      )
    };
  }

  return {
    filename: `pms-audit-${dateStamp}.csv`,
    csv: toCsv(
      ["Actor", "Entity", "Action", "Summary", "Created at"],
      data.audit.map((row) => [
        row.actorName,
        row.entityType,
        row.action,
        row.summary,
        row.createdAt
      ])
    )
  };
}
