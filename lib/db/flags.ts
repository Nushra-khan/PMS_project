import { PoolClient } from "pg";

import { getDirectReportIds, runWithClient, toDateString } from "@/lib/db/helpers";
import { insertAuditLog, queueNotification } from "@/lib/db/workflow-events";
import { AppSession, FeedbackSubmission, FlagItem } from "@/lib/types";

export type FlagRecord = FlagItem & {
  employeeName: string;
  employeeEmail: string;
  requestLabel: string;
};

export type FeedbackSubmissionRecord = FeedbackSubmission & {
  submitterName: string;
  targetName: string;
};

export type FlagPageData = {
  flags: FlagRecord[];
  submissions: FeedbackSubmissionRecord[];
};

type FlagContext = FlagRecord & {
  targetSubmissionLabel: string;
};

function mapFlagRow(row: {
  id: string;
  submission_id: string;
  employee_profile_id: string;
  severity: FlagItem["severity"];
  status: FlagItem["status"];
  reason: string;
  aged_at: string | Date;
  employee_name: string;
  employee_email: string;
  request_label: string;
}) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    employeeProfileId: row.employee_profile_id,
    severity: row.severity,
    status: row.status,
    reason: row.reason,
    agedAt: toDateString(row.aged_at) ?? "",
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    requestLabel: row.request_label
  } satisfies FlagRecord;
}

function mapSubmissionRow(row: {
  id: string;
  workflow_type: FeedbackSubmission["workflowType"];
  request_label: string;
  submitted_by: string;
  target_profile_id: string;
  related_checkpoint_id: string | null;
  related_cycle_id: string | null;
  score: string | number;
  comments: string;
  submitted_at: string | Date;
  submitter_name: string;
  target_name: string;
}) {
  return {
    id: row.id,
    workflowType: row.workflow_type,
    requestLabel: row.request_label,
    submittedBy: row.submitted_by,
    targetProfileId: row.target_profile_id,
    relatedCheckpointId: row.related_checkpoint_id ?? undefined,
    relatedCycleId: row.related_cycle_id ?? undefined,
    score: Number(row.score),
    comments: row.comments,
    submittedAt: toDateString(row.submitted_at) ?? "",
    submitterName: row.submitter_name,
    targetName: row.target_name
  } satisfies FeedbackSubmissionRecord;
}

async function getAccessibleTargetIds(session: AppSession) {
  if (session.role === "admin") {
    return [];
  }

  if (session.role !== "manager") {
    return [];
  }

  return runWithClient<string[]>([], async (client) => getDirectReportIds(client, session.userId));
}

async function getFlagRows(session: AppSession) {
  if (session.role === "admin") {
    return runWithClient<FlagRecord[]>([], async (client) => {
      const result = await client.query<{
        id: string;
        submission_id: string;
        employee_profile_id: string;
        severity: FlagItem["severity"];
        status: FlagItem["status"];
        reason: string;
        aged_at: string | Date;
        employee_name: string;
        employee_email: string;
        request_label: string;
      }>(
        `
          select
            flags.id,
            flags.submission_id,
            flags.employee_profile_id,
            flags.severity,
            flags.status,
            flags.reason,
            flags.aged_at,
            employee.full_name as employee_name,
            employee.email as employee_email,
            submissions.request_label
          from public.flags flags
          join public.feedback_submissions submissions on submissions.id = flags.submission_id
          join public.profiles employee on employee.id = flags.employee_profile_id
          order by flags.aged_at desc
        `
      );

      return result.rows.map(mapFlagRow);
    });
  }

  const accessibleTargetIds = await getAccessibleTargetIds(session);

  if (accessibleTargetIds.length === 0) {
    return [];
  }

  return runWithClient<FlagRecord[]>([], async (client) => {
    const result = await client.query<{
      id: string;
      submission_id: string;
      employee_profile_id: string;
      severity: FlagItem["severity"];
      status: FlagItem["status"];
      reason: string;
      aged_at: string | Date;
      employee_name: string;
      employee_email: string;
      request_label: string;
    }>(
      `
        select
          flags.id,
          flags.submission_id,
          flags.employee_profile_id,
          flags.severity,
          flags.status,
          flags.reason,
          flags.aged_at,
          employee.full_name as employee_name,
          employee.email as employee_email,
          submissions.request_label
        from public.flags flags
        join public.feedback_submissions submissions on submissions.id = flags.submission_id
        join public.profiles employee on employee.id = flags.employee_profile_id
        where flags.employee_profile_id = any($1::uuid[])
        order by flags.aged_at desc
      `,
      [accessibleTargetIds]
    );

    return result.rows.map(mapFlagRow);
  });
}

async function getSubmissionRows(session: AppSession) {
  if (session.role === "admin") {
    return runWithClient<FeedbackSubmissionRecord[]>([], async (client) => {
      const result = await client.query<{
        id: string;
        workflow_type: FeedbackSubmission["workflowType"];
        request_label: string;
        submitted_by: string;
        target_profile_id: string;
        related_checkpoint_id: string | null;
        related_cycle_id: string | null;
        score: string | number;
        comments: string;
        submitted_at: string | Date;
        submitter_name: string;
        target_name: string;
      }>(
        `
          select
            submissions.id,
            submissions.workflow_type,
            submissions.request_label,
            submissions.submitted_by,
            submissions.target_profile_id,
            submissions.related_checkpoint_id,
            submissions.related_cycle_id,
            submissions.score,
            submissions.comments,
            submissions.submitted_at,
            submitter.full_name as submitter_name,
            target.full_name as target_name
          from public.feedback_submissions submissions
          join public.profiles submitter on submitter.id = submissions.submitted_by
          join public.profiles target on target.id = submissions.target_profile_id
          order by submissions.submitted_at desc
        `
      );

      return result.rows.map(mapSubmissionRow);
    });
  }

  const accessibleTargetIds = await getAccessibleTargetIds(session);

  if (accessibleTargetIds.length === 0) {
    return [];
  }

  return runWithClient<FeedbackSubmissionRecord[]>([], async (client) => {
    const result = await client.query<{
      id: string;
      workflow_type: FeedbackSubmission["workflowType"];
      request_label: string;
      submitted_by: string;
      target_profile_id: string;
      related_checkpoint_id: string | null;
      related_cycle_id: string | null;
      score: string | number;
      comments: string;
      submitted_at: string | Date;
      submitter_name: string;
      target_name: string;
    }>(
      `
        select
          submissions.id,
          submissions.workflow_type,
          submissions.request_label,
          submissions.submitted_by,
          submissions.target_profile_id,
          submissions.related_checkpoint_id,
          submissions.related_cycle_id,
          submissions.score,
          submissions.comments,
          submissions.submitted_at,
          submitter.full_name as submitter_name,
          target.full_name as target_name
        from public.feedback_submissions submissions
        join public.profiles submitter on submitter.id = submissions.submitted_by
        join public.profiles target on target.id = submissions.target_profile_id
        where submissions.target_profile_id = any($1::uuid[])
        order by submissions.submitted_at desc
      `,
      [accessibleTargetIds]
    );

    return result.rows.map(mapSubmissionRow);
  });
}

async function getFlagContext(client: PoolClient, flagId: string) {
  const result = await client.query<{
    id: string;
    submission_id: string;
    employee_profile_id: string;
    severity: FlagItem["severity"];
    status: FlagItem["status"];
    reason: string;
    aged_at: string | Date;
    employee_name: string;
    employee_email: string;
    request_label: string;
  }>(
    `
      select
        flags.id,
        flags.submission_id,
        flags.employee_profile_id,
        flags.severity,
        flags.status,
        flags.reason,
        flags.aged_at,
        employee.full_name as employee_name,
        employee.email as employee_email,
        submissions.request_label
      from public.flags flags
      join public.feedback_submissions submissions on submissions.id = flags.submission_id
      join public.profiles employee on employee.id = flags.employee_profile_id
      where flags.id = $1
      limit 1
    `,
    [flagId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapFlagRow(row),
    targetSubmissionLabel: row.request_label
  } satisfies FlagContext;
}

async function canManageFlag(client: PoolClient, session: AppSession, flag: FlagContext) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role !== "manager") {
    return false;
  }

  const directReports = await getDirectReportIds(client, session.userId);
  return directReports.includes(flag.employeeProfileId);
}

export async function getFlagsPageData(session: AppSession): Promise<FlagPageData> {
  const [flags, submissions] = await Promise.all([
    getFlagRows(session),
    getSubmissionRows(session)
  ]);

  return { flags, submissions };
}

export async function getFlagPageDataCount(session: AppSession) {
  const { flags } = await getFlagsPageData(session);

  return {
    open: flags.filter((flag) => flag.status !== "resolved").length
  };
}

export async function updateFlagStatus(
  client: PoolClient,
  session: AppSession,
  input: {
    flagId: string;
    status: FlagItem["status"];
    notes?: string;
  }
) {
  const flag = await getFlagContext(client, input.flagId);

  if (!flag) {
    throw new Error("Flag was not found.");
  }

  const allowed = await canManageFlag(client, session, flag);

  if (!allowed) {
    throw new Error("You do not have permission to update this flag.");
  }

  await client.query(
    `
      update public.flags
      set status = $2
      where id = $1
    `,
    [input.flagId, input.status]
  );

  await client.query(
    `
      insert into public.flag_actions (flag_id, actor_profile_id, action, notes)
      values ($1, $2, $3, $4)
    `,
    [input.flagId, session.userId, input.status, input.notes ?? null]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "flag",
    entityId: input.flagId,
    action: input.status,
    summary: `${session.profile.name} marked a flag for ${flag.employeeName} as ${input.status}.`,
    metadata: {
      notes: input.notes ?? "",
      submissionId: flag.submissionId
    }
  });

  if (input.status === "escalated") {
    await queueNotification(client, {
      audienceRole: "admin",
      title: "Flag escalated",
      body: `${flag.employeeName}'s flag on ${flag.targetSubmissionLabel} was escalated for Admin review.`
    });
  }

  if (input.status === "resolved") {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Flag resolved",
      body: `${flag.employeeName}'s flag on ${flag.targetSubmissionLabel} was marked resolved.`
    });
  }
}
