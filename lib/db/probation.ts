import { PoolClient } from "pg";

import { addWorkingDays, WorkingDayLeavePeriod } from "@/lib/dates/working-days";
import { runWithClient, toDateOnly, toDateString } from "@/lib/db/helpers";
import {
  insertAuditLog,
  maybeCreateFeedbackFlags,
  queueNotification
} from "@/lib/db/workflow-events";
import {
  AppSession,
  FeedbackSubmission,
  ProbationCase,
  ProbationCheckpoint
} from "@/lib/types";

type ProbationDecisionValue = "confirm" | "extend_probation" | "review_further";

export type ProbationTimelineItem = {
  label: string;
  date: Date;
  description: string;
};

export type ProbationFeedbackRecord = FeedbackSubmission & {
  submittedByName: string;
  submittedByRole: "employee" | "manager";
};

export type ProbationDecisionRecord = {
  id: string;
  caseId: string;
  decision: ProbationDecisionValue;
  actorName: string;
  notes?: string;
  decidedAt: string;
};

export type ProbationCheckpointRecord = ProbationCheckpoint & {
  employeeName: string;
  submissions: ProbationFeedbackRecord[];
};

export type ProbationCaseRecord = ProbationCase & {
  employeeName: string;
  employeeEmail: string;
  managerName: string;
  managerEmail?: string;
  adminOwnerName: string;
  adminOwnerEmail: string;
  checkpoints: ProbationCheckpointRecord[];
  timeline: ProbationTimelineItem[];
  latestDecision?: ProbationDecisionRecord;
};

type CheckpointContext = {
  id: string;
  probationCaseId: string;
  checkpointType: ProbationCheckpoint["checkpointType"];
  formTitle: string;
  dueDate: string;
  revisedDueDate?: string;
  status: ProbationCheckpoint["status"];
  profileId: string;
  employeeName: string;
  employeeEmail: string;
  managerProfileId?: string;
  managerName: string;
  managerEmail?: string;
  adminOwnerProfileId: string;
  adminOwnerName: string;
  adminOwnerEmail: string;
};

function mapFeedbackRow(row: {
  id: string;
  workflow_type: FeedbackSubmission["workflowType"];
  request_label: string;
  submitted_by: string;
  target_profile_id: string;
  related_checkpoint_id: string | null;
  related_cycle_id: string | null;
  score: number;
  comments: string;
  created_at: string | Date;
  submitted_by_name: string;
  submitted_by_role: "employee" | "manager";
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
    submittedAt: toDateString(row.created_at) ?? "",
    submittedByName: row.submitted_by_name,
    submittedByRole: row.submitted_by_role
  } satisfies ProbationFeedbackRecord;
}

function mapDecisionRow(row: {
  id: string;
  probation_case_id: string;
  decision: ProbationDecisionValue;
  actor_name: string;
  notes: string | null;
  decided_at: string | Date;
}) {
  return {
    id: row.id,
    caseId: row.probation_case_id,
    decision: row.decision,
    actorName: row.actor_name,
    notes: row.notes ?? undefined,
    decidedAt: toDateString(row.decided_at) ?? ""
  } satisfies ProbationDecisionRecord;
}

async function getProbationCaseRows(session: AppSession) {
  return runWithClient<ProbationCaseRecord[]>([], async (client) => {
    let query = `
      select
        cases.id,
        cases.profile_id,
        employee.full_name as employee_name,
        employee.email as employee_email,
        cases.manager_profile_id,
        manager.full_name as manager_name,
        manager.email as manager_email,
        cases.status,
        cases.confirmation_call_date,
        cases.admin_owner_profile_id,
        admin_owner.full_name as admin_owner_name,
        admin_owner.email as admin_owner_email
      from public.probation_cases cases
      join public.profiles employee on employee.id = cases.profile_id
      left join public.profiles manager on manager.id = cases.manager_profile_id
      join public.profiles admin_owner on admin_owner.id = cases.admin_owner_profile_id
    `;
    const values: string[] = [];

    if (session.role === "manager") {
      query += " where cases.manager_profile_id = $1";
      values.push(session.userId);
    } else if (session.role === "employee") {
      query += " where cases.profile_id = $1";
      values.push(session.userId);
    }

    query += " order by employee.full_name asc";

    const result = await client.query<{
      id: string;
      profile_id: string;
      employee_name: string;
      employee_email: string;
      manager_profile_id: string | null;
      manager_name: string | null;
      manager_email: string | null;
      status: ProbationCase["status"];
      confirmation_call_date: string | Date | null;
      admin_owner_profile_id: string;
      admin_owner_name: string;
      admin_owner_email: string;
    }>(query, values);

    return result.rows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      managerProfileId: row.manager_profile_id ?? undefined,
      managerName: row.manager_name ?? "Unassigned",
      managerEmail: row.manager_email ?? undefined,
      status: row.status,
      confirmationCallDate: toDateOnly(row.confirmation_call_date),
      adminOwnerProfileId: row.admin_owner_profile_id,
      adminOwnerName: row.admin_owner_name,
      adminOwnerEmail: row.admin_owner_email,
      checkpoints: [],
      timeline: []
    }));
  });
}

async function getCheckpointRows(caseIds: string[]) {
  return runWithClient<ProbationCheckpointRecord[]>([], async (client) => {
    if (caseIds.length === 0) {
      return [];
    }

    const result = await client.query<{
      id: string;
      probation_case_id: string;
      checkpoint_type: ProbationCheckpoint["checkpointType"];
      form_title: string;
      due_date: string | Date;
      revised_due_date: string | Date | null;
      status: ProbationCheckpoint["status"];
      employee_name: string;
    }>(
      `
        select
          checkpoints.id,
          checkpoints.probation_case_id,
          checkpoints.checkpoint_type,
          checkpoints.form_title,
          checkpoints.due_date,
          checkpoints.revised_due_date,
          checkpoints.status,
          employee.full_name as employee_name
        from public.probation_checkpoints checkpoints
        join public.probation_cases cases on cases.id = checkpoints.probation_case_id
        join public.profiles employee on employee.id = cases.profile_id
        where checkpoints.probation_case_id = any($1::uuid[])
        order by checkpoints.due_date asc
      `,
      [caseIds]
    );

    return result.rows.map((row) => ({
      id: row.id,
      caseId: row.probation_case_id,
      checkpointType: row.checkpoint_type,
      formTitle: row.form_title,
      dueDate: toDateOnly(row.due_date) ?? "",
      revisedDueDate: toDateOnly(row.revised_due_date),
      status: row.status,
      employeeName: row.employee_name,
      submissions: []
    }));
  });
}

async function getCheckpointFeedbackRows(checkpointIds: string[]) {
  return runWithClient<ProbationFeedbackRecord[]>([], async (client) => {
    if (checkpointIds.length === 0) {
      return [];
    }

    const result = await client.query<{
      id: string;
      workflow_type: FeedbackSubmission["workflowType"];
      request_label: string;
      submitted_by: string;
      target_profile_id: string;
      related_checkpoint_id: string | null;
      related_cycle_id: string | null;
      score: number;
      comments: string;
      created_at: string | Date;
      submitted_by_name: string;
      submitted_by_role: "employee" | "manager";
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
          submissions.created_at,
          actor.full_name as submitted_by_name,
          case
            when submissions.submitted_by = cases.profile_id then 'employee'
            else 'manager'
          end as submitted_by_role
        from public.feedback_submissions submissions
        join public.probation_checkpoints checkpoints
          on checkpoints.id = submissions.related_checkpoint_id
        join public.probation_cases cases
          on cases.id = checkpoints.probation_case_id
        join public.profiles actor
          on actor.id = submissions.submitted_by
        where submissions.related_checkpoint_id = any($1::uuid[])
        order by submissions.created_at asc
      `,
      [checkpointIds]
    );

    return result.rows.map(mapFeedbackRow);
  });
}

async function getProbationDecisionRows(caseIds: string[]) {
  return runWithClient<ProbationDecisionRecord[]>([], async (client) => {
    if (caseIds.length === 0) {
      return [];
    }

    const result = await client.query<{
      id: string;
      probation_case_id: string;
      decision: ProbationDecisionValue;
      actor_name: string;
      notes: string | null;
      decided_at: string | Date;
    }>(
      `
        select
          decisions.id,
          decisions.probation_case_id,
          decisions.decision,
          actor.full_name as actor_name,
          decisions.notes,
          decisions.decided_at
        from public.probation_decisions decisions
        join public.profiles actor on actor.id = decisions.actor_profile_id
        where decisions.probation_case_id = any($1::uuid[])
        order by decisions.decided_at desc
      `,
      [caseIds]
    );

    return result.rows.map(mapDecisionRow);
  });
}

async function getLeavePeriods(profileId: string) {
  return runWithClient<WorkingDayLeavePeriod[]>([], async (client) => {
    const result = await client.query<{
      start_date: string | Date;
      end_date: string | Date;
    }>(
      `
        select start_date, end_date
        from public.leave_periods
        where profile_id = $1
        order by start_date asc
      `,
      [profileId]
    );

    return result.rows.map((row) => ({
      startDate: toDateOnly(row.start_date) ?? "",
      endDate: toDateOnly(row.end_date) ?? ""
    }));
  });
}

async function getDateOfJoining(profileId: string) {
  return runWithClient<string | null>(null, async (client) => {
    const result = await client.query<{ date_of_joining: string | Date }>(
      `
        select date_of_joining
        from public.profiles
        where id = $1
        limit 1
      `,
      [profileId]
    );

    return toDateOnly(result.rows[0]?.date_of_joining) ?? null;
  });
}

async function buildTimeline(profileId: string) {
  const [dateOfJoining, periods] = await Promise.all([
    getDateOfJoining(profileId),
    getLeavePeriods(profileId)
  ]);

  if (!dateOfJoining) {
    return [];
  }

  return [
    {
      label: "Day 30",
      date: addWorkingDays(dateOfJoining, 30, periods),
      description: "Initial check-in with paired employee and manager forms."
    },
    {
      label: "Day 60",
      date: addWorkingDays(dateOfJoining, 60, periods),
      description: "Mid-probation review with reminder tracking and escalation."
    },
    {
      label: "Day 80",
      date: addWorkingDays(dateOfJoining, 80, periods),
      description: "Final pre-confirmation review and manager briefing prep."
    }
  ] satisfies ProbationTimelineItem[];
}

async function hydrateProbationCases(cases: ProbationCaseRecord[]) {
  const checkpoints = await getCheckpointRows(cases.map((entry) => entry.id));
  const submissions = await getCheckpointFeedbackRows(checkpoints.map((entry) => entry.id));
  const decisions = await getProbationDecisionRows(cases.map((entry) => entry.id));

  for (const checkpoint of checkpoints) {
    checkpoint.submissions = submissions.filter(
      (submission) => submission.relatedCheckpointId === checkpoint.id
    );
  }

  for (const probationCase of cases) {
    probationCase.checkpoints = checkpoints.filter(
      (checkpoint) => checkpoint.caseId === probationCase.id
    );
    probationCase.timeline = await buildTimeline(probationCase.profileId);
    probationCase.latestDecision = decisions.find(
      (decision) => decision.caseId === probationCase.id
    );
  }

  return { cases, checkpoints };
}

async function getCheckpointContext(client: PoolClient, checkpointId: string) {
  const result = await client.query<{
    id: string;
    probation_case_id: string;
    checkpoint_type: ProbationCheckpoint["checkpointType"];
    form_title: string;
    due_date: string | Date;
    revised_due_date: string | Date | null;
    status: ProbationCheckpoint["status"];
    profile_id: string;
    employee_name: string;
    employee_email: string;
    manager_profile_id: string | null;
    manager_name: string | null;
    manager_email: string | null;
    admin_owner_profile_id: string;
    admin_owner_name: string;
    admin_owner_email: string;
  }>(
    `
      select
        checkpoints.id,
        checkpoints.probation_case_id,
        checkpoints.checkpoint_type,
        checkpoints.form_title,
        checkpoints.due_date,
        checkpoints.revised_due_date,
        checkpoints.status,
        cases.profile_id,
        employee.full_name as employee_name,
        employee.email as employee_email,
        cases.manager_profile_id,
        manager.full_name as manager_name,
        manager.email as manager_email,
        cases.admin_owner_profile_id,
        admin_owner.full_name as admin_owner_name,
        admin_owner.email as admin_owner_email
      from public.probation_checkpoints checkpoints
      join public.probation_cases cases on cases.id = checkpoints.probation_case_id
      join public.profiles employee on employee.id = cases.profile_id
      left join public.profiles manager on manager.id = cases.manager_profile_id
      join public.profiles admin_owner on admin_owner.id = cases.admin_owner_profile_id
      where checkpoints.id = $1
      limit 1
    `,
    [checkpointId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    probationCaseId: row.probation_case_id,
    checkpointType: row.checkpoint_type,
    formTitle: row.form_title,
    dueDate: toDateOnly(row.due_date) ?? "",
    revisedDueDate: toDateOnly(row.revised_due_date),
    status: row.status,
    profileId: row.profile_id,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    managerProfileId: row.manager_profile_id ?? undefined,
    managerName: row.manager_name ?? "Unassigned",
    managerEmail: row.manager_email ?? undefined,
    adminOwnerProfileId: row.admin_owner_profile_id,
    adminOwnerName: row.admin_owner_name,
    adminOwnerEmail: row.admin_owner_email
  } satisfies CheckpointContext;
}

async function ensureFeedbackRequest(
  client: PoolClient,
  input: {
    requestKind: "employee" | "manager";
    targetProfileId: string;
    reviewerProfileId: string;
    relatedCheckpointId: string;
    dueDate: string;
    status: "not_started" | "in_progress" | "submitted";
  }
) {
  const existingResult = await client.query<{ id: string }>(
    `
      select id
      from public.feedback_requests
      where workflow_type = 'probation'
        and request_kind = $1
        and target_profile_id = $2
        and reviewer_profile_id = $3
        and related_checkpoint_id = $4
      limit 1
    `,
    [
      input.requestKind,
      input.targetProfileId,
      input.reviewerProfileId,
      input.relatedCheckpointId
    ]
  );

  const existingId = existingResult.rows[0]?.id;

  if (existingId) {
    await client.query(
      `
        update public.feedback_requests
        set
          due_date = $2,
          status = $3
        where id = $1
      `,
      [existingId, input.dueDate, input.status]
    );

    return existingId;
  }

  const insertResult = await client.query<{ id: string }>(
    `
      insert into public.feedback_requests (
        workflow_type,
        request_kind,
        target_profile_id,
        reviewer_profile_id,
        related_checkpoint_id,
        due_date,
        status
      )
      values ('probation', $1, $2, $3, $4, $5, $6)
      returning id
    `,
    [
      input.requestKind,
      input.targetProfileId,
      input.reviewerProfileId,
      input.relatedCheckpointId,
      input.dueDate,
      input.status
    ]
  );

  return insertResult.rows[0]?.id ?? null;
}

export async function getProbationPageData(session: AppSession) {
  const cases = await getProbationCaseRows(session);

  return hydrateProbationCases(cases);
}

export async function getProbationCaseCount(session: AppSession) {
  const cases = await getProbationCaseRows(session);

  return {
    total: cases.length,
    active: cases.filter((entry) => entry.status !== "completed").length
  };
}

export async function getAdminProbationPageData(session: AppSession) {
  const cases = await getProbationCaseRows(session);

  return hydrateProbationCases(cases);
}

export async function submitProbationFeedback(
  client: PoolClient,
  session: AppSession,
  input: {
    checkpointId: string;
    score: number;
    comments: string;
  }
) {
  const checkpoint = await getCheckpointContext(client, input.checkpointId);

  if (!checkpoint) {
    throw new Error("Probation checkpoint was not found.");
  }

  if (
    checkpoint.status === "blocked" ||
    checkpoint.status === "waived" ||
    checkpoint.status === "cancelled"
  ) {
    throw new Error("This checkpoint is not currently open for submissions.");
  }

  let actorKind: "employee" | "manager";
  let counterpartProfileId: string | undefined;
  let counterpartEmail: string | undefined;

  if (session.userId === checkpoint.profileId) {
    actorKind = "employee";
    counterpartProfileId = checkpoint.managerProfileId;
    counterpartEmail = checkpoint.managerEmail;
  } else if (checkpoint.managerProfileId && session.userId === checkpoint.managerProfileId) {
    actorKind = "manager";
    counterpartProfileId = checkpoint.profileId;
    counterpartEmail = checkpoint.employeeEmail;
  } else {
    throw new Error("You do not have permission to submit this probation feedback.");
  }

  const existingOwnResult = await client.query<{ id: string }>(
    `
      select id
      from public.feedback_submissions
      where related_checkpoint_id = $1
        and submitted_by = $2
      limit 1
    `,
    [input.checkpointId, session.userId]
  );

  if (existingOwnResult.rows[0]) {
    throw new Error("You have already submitted feedback for this checkpoint.");
  }

  const requestDueDate = checkpoint.revisedDueDate ?? checkpoint.dueDate;

  await ensureFeedbackRequest(client, {
    requestKind: "employee",
    targetProfileId: checkpoint.profileId,
    reviewerProfileId: checkpoint.profileId,
    relatedCheckpointId: input.checkpointId,
    dueDate: requestDueDate,
    status: actorKind === "employee" ? "submitted" : "in_progress"
  });

  if (checkpoint.managerProfileId) {
    await ensureFeedbackRequest(client, {
      requestKind: "manager",
      targetProfileId: checkpoint.profileId,
      reviewerProfileId: checkpoint.managerProfileId,
      relatedCheckpointId: input.checkpointId,
      dueDate: requestDueDate,
      status: actorKind === "manager" ? "submitted" : "in_progress"
    });
  }

  const requestLabel = `${checkpoint.formTitle} ${
    actorKind === "employee" ? "self-feedback" : "manager feedback"
  }`;
  const submissionResult = await client.query<{ id: string }>(
    `
      insert into public.feedback_submissions (
        workflow_type,
        request_label,
        submitted_by,
        target_profile_id,
        related_checkpoint_id,
        score,
        comments
      )
      values ('probation', $1, $2, $3, $4, $5, $6)
      returning id
    `,
    [
      requestLabel,
      session.userId,
      checkpoint.profileId,
      input.checkpointId,
      input.score,
      input.comments
    ]
  );

  const submissionId = submissionResult.rows[0]?.id;

  if (!submissionId) {
    throw new Error("Probation feedback could not be saved.");
  }

  const counterpartSubmittedResult = await client.query<{ id: string }>(
    `
      select id
      from public.feedback_submissions
      where related_checkpoint_id = $1
        and submitted_by <> $2
      limit 1
    `,
    [input.checkpointId, session.userId]
  );

  const hasCounterpartSubmission = Boolean(counterpartSubmittedResult.rows[0]);
  const nextCheckpointStatus = hasCounterpartSubmission
    ? "shared"
    : actorKind === "employee"
      ? checkpoint.managerProfileId
        ? "waiting_for_manager"
        : "blocked"
      : "waiting_for_employee";

  await client.query(
    `
      update public.probation_checkpoints
      set status = $2
      where id = $1
    `,
    [input.checkpointId, nextCheckpointStatus]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "probation_feedback",
    entityId: submissionId,
    action: actorKind === "employee" ? "submit_employee_feedback" : "submit_manager_feedback",
    summary:
      actorKind === "employee"
        ? `${checkpoint.employeeName} submitted ${checkpoint.formTitle} self-feedback.`
        : `${session.profile.name} submitted manager feedback for ${checkpoint.employeeName} on ${checkpoint.formTitle}.`,
    metadata: {
      checkpointId: checkpoint.id,
      checkpointType: checkpoint.checkpointType,
      score: input.score
    }
  });

  await maybeCreateFeedbackFlags(client, {
    submissionId,
    employeeProfileId: checkpoint.profileId,
    score: input.score,
    comments: input.comments,
    requestLabel
  });

  if (actorKind === "employee") {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Probation feedback submitted",
      body: `${checkpoint.employeeName} submitted ${checkpoint.formTitle} self-feedback.`,
      recipientEmail: counterpartEmail
    });
  } else {
    await queueNotification(client, {
      audienceRole: "employee",
      title: "Manager feedback submitted",
      body: `Manager feedback for ${checkpoint.formTitle} has been submitted.`,
      recipientEmail: counterpartEmail
    });
  }

  if (hasCounterpartSubmission) {
    await insertAuditLog(client, {
      actorProfileId: session.userId,
      entityType: "probation_checkpoint",
      entityId: checkpoint.id,
      action: "cross_share",
      summary: `${checkpoint.formTitle} is now shared between employee and manager.`,
      metadata: {
        checkpointType: checkpoint.checkpointType,
        probationCaseId: checkpoint.probationCaseId
      }
    });

    await queueNotification(client, {
      audienceRole: "employee",
      title: "Probation feedback shared",
      body: `${checkpoint.formTitle} feedback is now available for cross-review.`,
      recipientEmail: checkpoint.employeeEmail
    });

    await queueNotification(client, {
      audienceRole: "manager",
      title: "Probation feedback shared",
      body: `${checkpoint.formTitle} feedback is now available for cross-review.`,
      recipientEmail: checkpoint.managerEmail
    });

    await queueNotification(client, {
      audienceRole: "admin",
      title: "Probation checkpoint ready",
      body: `${checkpoint.employeeName}'s ${checkpoint.formTitle} feedback set is complete and shared.`
    });
  } else if (!counterpartProfileId) {
    await queueNotification(client, {
      audienceRole: "admin",
      title: "Probation checkpoint blocked",
      body: `${checkpoint.employeeName}'s ${checkpoint.formTitle} is blocked because no manager is assigned.`
    });
  }

  return submissionId;
}

export async function recordProbationDecision(
  client: PoolClient,
  session: AppSession,
  input: {
    caseId: string;
    decision: ProbationDecisionValue;
    notes: string;
  }
) {
  if (session.role !== "admin") {
    throw new Error("Only Admin can record probation decisions.");
  }

  const caseResult = await client.query<{
    id: string;
    profile_id: string;
    employee_name: string;
    employee_email: string;
    manager_profile_id: string | null;
    manager_name: string | null;
    manager_email: string | null;
  }>(
    `
      select
        cases.id,
        cases.profile_id,
        employee.full_name as employee_name,
        employee.email as employee_email,
        cases.manager_profile_id,
        manager.full_name as manager_name,
        manager.email as manager_email
      from public.probation_cases cases
      join public.profiles employee on employee.id = cases.profile_id
      left join public.profiles manager on manager.id = cases.manager_profile_id
      where cases.id = $1
      limit 1
    `,
    [input.caseId]
  );

  const probationCase = caseResult.rows[0];

  if (!probationCase) {
    throw new Error("Probation case was not found.");
  }

  const decisionResult = await client.query<{ id: string }>(
    `
      insert into public.probation_decisions (
        probation_case_id,
        decision,
        actor_profile_id,
        notes
      )
      values ($1, $2, $3, $4)
      returning id
    `,
    [input.caseId, input.decision, session.userId, input.notes]
  );

  const nextStatus =
    input.decision === "confirm"
      ? "completed"
      : input.decision === "extend_probation"
        ? "extended"
        : "active";

  await client.query(
    `
      update public.probation_cases
      set status = $2
      where id = $1
    `,
    [input.caseId, nextStatus]
  );

  await client.query(
    `
      update public.employee_records
      set probation_status = $2
      where profile_id = $1
    `,
    [probationCase.profile_id, nextStatus]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "probation_case",
    entityId: input.caseId,
    action: input.decision,
    summary: `Admin recorded a probation decision for ${probationCase.employee_name}: ${input.decision}.`,
    metadata: {
      notes: input.notes
    }
  });

  await queueNotification(client, {
    audienceRole: "employee",
    title: "Probation decision recorded",
    body: `A probation decision was recorded for your case: ${input.decision}.`,
    recipientEmail: probationCase.employee_email
  });

  if (probationCase.manager_email) {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Probation decision recorded",
      body: `${probationCase.employee_name}'s probation decision is now ${input.decision}.`,
      recipientEmail: probationCase.manager_email
    });
  }

  return decisionResult.rows[0]?.id ?? null;
}
