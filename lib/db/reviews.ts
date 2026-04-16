import { PoolClient } from "pg";

import {
  getDirectReportIds,
  runWithClient,
  toDateOnly,
  toDateString
} from "@/lib/db/helpers";
import {
  insertAuditLog,
  queueNotification
} from "@/lib/db/workflow-events";
import {
  AppSession,
  CycleEnrollment,
  DiscussionStatus,
  RatingValue,
  ReviewCycle,
  ReviewStatus,
  ReviewSubmission
} from "@/lib/types";

export type ReviewCycleRecord = ReviewCycle;

export type CycleEnrollmentRecord = CycleEnrollment & {
  employeeName: string;
  employeeEmail: string;
  managerName: string;
  managerEmail: string;
};

export type ReviewSubmissionRecord = ReviewSubmission & {
  profileName: string;
  reviewerName: string;
};

export type ReviewsPageData = {
  cycles: ReviewCycleRecord[];
  enrollments: CycleEnrollmentRecord[];
};

export type CycleDetailPageData = {
  cycle: ReviewCycleRecord;
  enrollments: CycleEnrollmentRecord[];
  submissions: ReviewSubmissionRecord[];
};

type EnrollmentContext = CycleEnrollmentRecord & {
  cycleLabel: string;
};

function mapCycleRow(row: {
  id: string;
  label: string;
  cycle_type: ReviewCycle["cycleType"];
  goal_window_label: string;
  trigger_date: string | Date;
  close_date: string | Date;
  finalize_from: string | Date | null;
}) {
  return {
    id: row.id,
    label: row.label,
    cycleType: row.cycle_type,
    goalWindowLabel: row.goal_window_label,
    triggerDate: toDateOnly(row.trigger_date) ?? "",
    closeDate: toDateOnly(row.close_date) ?? "",
    finalizeFrom: toDateOnly(row.finalize_from)
  } satisfies ReviewCycleRecord;
}

function mapEnrollmentRow(row: {
  id: string;
  cycle_id: string;
  profile_id: string;
  manager_profile_id: string;
  review_status: CycleEnrollment["reviewStatus"];
  discussion_status: CycleEnrollment["discussionStatus"];
  final_rating: CycleEnrollment["finalRating"] | null;
  employee_name: string;
  employee_email: string;
  manager_name: string;
  manager_email: string;
}) {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    profileId: row.profile_id,
    managerProfileId: row.manager_profile_id,
    reviewStatus: row.review_status,
    discussionStatus: row.discussion_status,
    finalRating: row.final_rating ?? undefined,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    managerName: row.manager_name,
    managerEmail: row.manager_email
  } satisfies CycleEnrollmentRecord;
}

function mapSubmissionRow(row: {
  id: string;
  cycle_id: string;
  profile_id: string;
  reviewer_profile_id: string;
  submission_type: ReviewSubmission["submissionType"];
  status: ReviewSubmission["status"];
  submitted_at: string | Date | null;
  rating: ReviewSubmission["rating"] | null;
  profile_name: string;
  reviewer_name: string;
}) {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    profileId: row.profile_id,
    reviewerProfileId: row.reviewer_profile_id,
    submissionType: row.submission_type,
    status: row.status,
    submittedAt: toDateString(row.submitted_at),
    rating: row.rating ?? undefined,
    profileName: row.profile_name,
    reviewerName: row.reviewer_name
  } satisfies ReviewSubmissionRecord;
}

async function getAccessibleProfileIds(session: AppSession) {
  if (session.role === "admin") {
    return [];
  }

  return runWithClient<string[]>([session.userId], async (client) => {
    if (session.role === "manager") {
      return [session.userId, ...(await getDirectReportIds(client, session.userId))];
    }

    return [session.userId];
  });
}

async function getAccessibleCycleRows(session: AppSession) {
  if (session.role === "admin") {
    return runWithClient<ReviewCycleRecord[]>([], async (client) => {
      const result = await client.query<{
        id: string;
        label: string;
        cycle_type: ReviewCycle["cycleType"];
        goal_window_label: string;
        trigger_date: string | Date;
        close_date: string | Date;
        finalize_from: string | Date | null;
      }>(
        `
          select id, label, cycle_type, goal_window_label, trigger_date, close_date, finalize_from
          from public.review_cycles
          order by trigger_date desc
        `
      );

      return result.rows.map(mapCycleRow);
    });
  }

  const accessibleProfileIds = await getAccessibleProfileIds(session);

  if (accessibleProfileIds.length === 0) {
    return [];
  }

  return runWithClient<ReviewCycleRecord[]>([], async (client) => {
    const result = await client.query<{
      id: string;
      label: string;
      cycle_type: ReviewCycle["cycleType"];
      goal_window_label: string;
      trigger_date: string | Date;
      close_date: string | Date;
      finalize_from: string | Date | null;
    }>(
      `
        select distinct
          cycles.id,
          cycles.label,
          cycles.cycle_type,
          cycles.goal_window_label,
          cycles.trigger_date,
          cycles.close_date,
          cycles.finalize_from
        from public.review_cycles cycles
        join public.cycle_enrollments enrollments on enrollments.cycle_id = cycles.id
        where enrollments.profile_id = any($1::uuid[])
        order by cycles.trigger_date desc
      `,
      [accessibleProfileIds]
    );

    return result.rows.map(mapCycleRow);
  });
}

async function getEnrollmentRows(session: AppSession, cycleId?: string) {
  if (session.role === "admin") {
    return runWithClient<CycleEnrollmentRecord[]>([], async (client) => {
      const result = await client.query<{
        id: string;
        cycle_id: string;
        profile_id: string;
        manager_profile_id: string;
        review_status: CycleEnrollment["reviewStatus"];
        discussion_status: CycleEnrollment["discussionStatus"];
        final_rating: CycleEnrollment["finalRating"] | null;
        employee_name: string;
        employee_email: string;
        manager_name: string;
        manager_email: string;
      }>(
        `
          select
            enrollments.id,
            enrollments.cycle_id,
            enrollments.profile_id,
            enrollments.manager_profile_id,
            enrollments.review_status,
            enrollments.discussion_status,
            enrollments.final_rating,
            employee.full_name as employee_name,
            employee.email as employee_email,
            manager.full_name as manager_name,
            manager.email as manager_email
          from public.cycle_enrollments enrollments
          join public.profiles employee on employee.id = enrollments.profile_id
          join public.profiles manager on manager.id = enrollments.manager_profile_id
          where ($1::uuid is null or enrollments.cycle_id = $1)
          order by employee.full_name asc
        `,
        [cycleId ?? null]
      );

      return result.rows.map(mapEnrollmentRow);
    });
  }

  const accessibleProfileIds = await getAccessibleProfileIds(session);

  if (accessibleProfileIds.length === 0) {
    return [];
  }

  return runWithClient<CycleEnrollmentRecord[]>([], async (client) => {
    const result = await client.query<{
      id: string;
      cycle_id: string;
      profile_id: string;
      manager_profile_id: string;
      review_status: CycleEnrollment["reviewStatus"];
      discussion_status: CycleEnrollment["discussionStatus"];
      final_rating: CycleEnrollment["finalRating"] | null;
      employee_name: string;
      employee_email: string;
      manager_name: string;
      manager_email: string;
    }>(
      `
        select
          enrollments.id,
          enrollments.cycle_id,
          enrollments.profile_id,
          enrollments.manager_profile_id,
          enrollments.review_status,
          enrollments.discussion_status,
          enrollments.final_rating,
          employee.full_name as employee_name,
          employee.email as employee_email,
          manager.full_name as manager_name,
          manager.email as manager_email
        from public.cycle_enrollments enrollments
        join public.profiles employee on employee.id = enrollments.profile_id
        join public.profiles manager on manager.id = enrollments.manager_profile_id
        where enrollments.profile_id = any($1::uuid[])
          and ($2::uuid is null or enrollments.cycle_id = $2)
        order by employee.full_name asc
      `,
      [accessibleProfileIds, cycleId ?? null]
    );

    return result.rows.map(mapEnrollmentRow);
  });
}

async function getSubmissionRows(session: AppSession, cycleId: string) {
  if (session.role === "admin") {
    return runWithClient<ReviewSubmissionRecord[]>([], async (client) => {
      const result = await client.query<{
        id: string;
        cycle_id: string;
        profile_id: string;
        reviewer_profile_id: string;
        submission_type: ReviewSubmission["submissionType"];
        status: ReviewSubmission["status"];
        submitted_at: string | Date | null;
        rating: ReviewSubmission["rating"] | null;
        profile_name: string;
        reviewer_name: string;
      }>(
        `
          select
            submissions.id,
            submissions.cycle_id,
            submissions.profile_id,
            submissions.reviewer_profile_id,
            submissions.submission_type,
            submissions.status,
            submissions.submitted_at,
            submissions.rating,
            profile.full_name as profile_name,
            reviewer.full_name as reviewer_name
          from public.review_submissions submissions
          join public.profiles profile on profile.id = submissions.profile_id
          join public.profiles reviewer on reviewer.id = submissions.reviewer_profile_id
          where submissions.cycle_id = $1
          order by submissions.submitted_at desc nulls last
        `,
        [cycleId]
      );

      return result.rows.map(mapSubmissionRow);
    });
  }

  const accessibleProfileIds = await getAccessibleProfileIds(session);

  if (accessibleProfileIds.length === 0) {
    return [];
  }

  return runWithClient<ReviewSubmissionRecord[]>([], async (client) => {
    const result = await client.query<{
      id: string;
      cycle_id: string;
      profile_id: string;
      reviewer_profile_id: string;
      submission_type: ReviewSubmission["submissionType"];
      status: ReviewSubmission["status"];
      submitted_at: string | Date | null;
      rating: ReviewSubmission["rating"] | null;
      profile_name: string;
      reviewer_name: string;
    }>(
      `
        select
          submissions.id,
          submissions.cycle_id,
          submissions.profile_id,
          submissions.reviewer_profile_id,
          submissions.submission_type,
          submissions.status,
          submissions.submitted_at,
          submissions.rating,
          profile.full_name as profile_name,
          reviewer.full_name as reviewer_name
        from public.review_submissions submissions
        join public.profiles profile on profile.id = submissions.profile_id
        join public.profiles reviewer on reviewer.id = submissions.reviewer_profile_id
        where submissions.cycle_id = $1
          and submissions.profile_id = any($2::uuid[])
        order by submissions.submitted_at desc nulls last
      `,
      [cycleId, accessibleProfileIds]
    );

    return result.rows.map(mapSubmissionRow);
  });
}

async function getEnrollmentContext(
  client: PoolClient,
  cycleId: string,
  profileId: string
) {
  const result = await client.query<{
    id: string;
    cycle_id: string;
    profile_id: string;
    manager_profile_id: string;
    review_status: CycleEnrollment["reviewStatus"];
    discussion_status: CycleEnrollment["discussionStatus"];
    final_rating: CycleEnrollment["finalRating"] | null;
    employee_name: string;
    employee_email: string;
    manager_name: string;
    manager_email: string;
    cycle_label: string;
  }>(
    `
      select
        enrollments.id,
        enrollments.cycle_id,
        enrollments.profile_id,
        enrollments.manager_profile_id,
        enrollments.review_status,
        enrollments.discussion_status,
        enrollments.final_rating,
        employee.full_name as employee_name,
        employee.email as employee_email,
        manager.full_name as manager_name,
        manager.email as manager_email,
        cycles.label as cycle_label
      from public.cycle_enrollments enrollments
      join public.profiles employee on employee.id = enrollments.profile_id
      join public.profiles manager on manager.id = enrollments.manager_profile_id
      join public.review_cycles cycles on cycles.id = enrollments.cycle_id
      where enrollments.cycle_id = $1
        and enrollments.profile_id = $2
      limit 1
    `,
    [cycleId, profileId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapEnrollmentRow(row),
    cycleLabel: row.cycle_label
  } satisfies EnrollmentContext;
}

async function getSubmissionPresence(
  client: PoolClient,
  cycleId: string,
  profileId: string
) {
  const result = await client.query<{
    submission_type: ReviewSubmission["submissionType"];
  }>(
    `
      select submission_type
      from public.review_submissions
      where cycle_id = $1
        and profile_id = $2
        and submitted_at is not null
    `,
    [cycleId, profileId]
  );

  return {
    hasSelf: result.rows.some((row) => row.submission_type === "self_review"),
    hasManager: result.rows.some((row) => row.submission_type === "manager_review")
  };
}

function deriveEnrollmentReviewStatus(input: {
  hasSelf: boolean;
  hasManager: boolean;
  discussionStatus: DiscussionStatus;
}): ReviewStatus {
  if (input.hasManager && input.discussionStatus === "completed") {
    return "finalized";
  }

  if (input.hasManager) {
    return "submitted";
  }

  if (input.hasSelf) {
    return "in_progress";
  }

  return "not_started";
}

async function canManageEnrollment(
  client: PoolClient,
  session: AppSession,
  enrollment: EnrollmentContext
) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role !== "manager") {
    return false;
  }

  if (session.userId === enrollment.managerProfileId) {
    return true;
  }

  const directReports = await getDirectReportIds(client, session.userId);
  return directReports.includes(enrollment.profileId);
}

async function upsertReviewSubmission(
  client: PoolClient,
  input: {
    cycleId: string;
    profileId: string;
    reviewerProfileId: string;
    submissionType: ReviewSubmission["submissionType"];
    rating?: RatingValue;
    comments: string;
  }
) {
  const existingResult = await client.query<{ id: string }>(
    `
      select id
      from public.review_submissions
      where cycle_id = $1
        and profile_id = $2
        and submission_type = $3
      limit 1
    `,
    [input.cycleId, input.profileId, input.submissionType]
  );

  const existingId = existingResult.rows[0]?.id;

  if (existingId) {
    await client.query(
      `
        update public.review_submissions
        set
          reviewer_profile_id = $2,
          status = 'submitted',
          rating = $3,
          comments = $4,
          submitted_at = timezone('utc', now())
        where id = $1
      `,
      [existingId, input.reviewerProfileId, input.rating ?? null, input.comments]
    );

    return existingId;
  }

  const insertResult = await client.query<{ id: string }>(
    `
      insert into public.review_submissions (
        cycle_id,
        profile_id,
        reviewer_profile_id,
        submission_type,
        status,
        rating,
        comments,
        submitted_at
      )
      values ($1, $2, $3, $4, 'submitted', $5, $6, timezone('utc', now()))
      returning id
    `,
    [
      input.cycleId,
      input.profileId,
      input.reviewerProfileId,
      input.submissionType,
      input.rating ?? null,
      input.comments
    ]
  );

  return insertResult.rows[0]?.id ?? null;
}

export async function getReviewsPageData(session: AppSession): Promise<ReviewsPageData> {
  const [cycles, enrollments] = await Promise.all([
    getAccessibleCycleRows(session),
    getEnrollmentRows(session)
  ]);

  return { cycles, enrollments };
}

export async function getCycleDetailPageData(
  session: AppSession,
  cycleId: string
): Promise<CycleDetailPageData | null> {
  const cycles = await getAccessibleCycleRows(session);
  const cycle = cycles.find((entry) => entry.id === cycleId);

  if (!cycle) {
    return null;
  }

  const [enrollments, submissions] = await Promise.all([
    getEnrollmentRows(session, cycleId),
    getSubmissionRows(session, cycleId)
  ]);

  return {
    cycle,
    enrollments,
    submissions
  };
}

export async function getReviewCycleCount(session: AppSession) {
  const cycles = await getAccessibleCycleRows(session);

  return cycles.length;
}

export async function submitReviewSubmission(
  client: PoolClient,
  session: AppSession,
  input: {
    cycleId: string;
    profileId: string;
    submissionType: ReviewSubmission["submissionType"];
    rating?: RatingValue;
    comments: string;
  }
) {
  const enrollment = await getEnrollmentContext(client, input.cycleId, input.profileId);

  if (!enrollment) {
    throw new Error("Review enrollment was not found.");
  }

  if (input.submissionType === "self_review") {
    if (session.userId !== enrollment.profileId) {
      throw new Error("You can only submit your own self review.");
    }
  } else {
    const allowed = await canManageEnrollment(client, session, enrollment);

    if (!allowed) {
      throw new Error("You do not have permission to submit this manager review.");
    }

    if (!input.rating) {
      throw new Error("Manager review requires a final rating.");
    }
  }

  if (!input.rating) {
    throw new Error("A rating is required before submission.");
  }

  const submissionId = await upsertReviewSubmission(client, {
    cycleId: input.cycleId,
    profileId: input.profileId,
    reviewerProfileId: session.userId,
    submissionType: input.submissionType,
    rating: input.rating,
    comments: input.comments
  });

  const presence = await getSubmissionPresence(client, input.cycleId, input.profileId);
  const nextPresence =
    input.submissionType === "self_review"
      ? { ...presence, hasSelf: true }
      : { ...presence, hasManager: true };
  const nextReviewStatus = deriveEnrollmentReviewStatus({
    ...nextPresence,
    discussionStatus: enrollment.discussionStatus
  });

  await client.query(
    `
      update public.cycle_enrollments
      set
        review_status = $3,
        final_rating = $4
      where cycle_id = $1
        and profile_id = $2
    `,
    [
      input.cycleId,
      input.profileId,
      nextReviewStatus,
      input.submissionType === "manager_review"
        ? input.rating
        : enrollment.finalRating ?? null
    ]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "review_submission",
    entityId: submissionId,
    action: input.submissionType === "self_review" ? "submit_self_review" : "submit_manager_review",
    summary:
      input.submissionType === "self_review"
        ? `${enrollment.employeeName} submitted a self review for ${enrollment.cycleLabel}.`
        : `${session.profile.name} submitted the manager review for ${enrollment.employeeName} in ${enrollment.cycleLabel}.`,
    metadata: {
      cycleId: input.cycleId,
      profileId: input.profileId,
      submissionType: input.submissionType
    }
  });

  if (input.submissionType === "self_review") {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Self review submitted",
      body: `${enrollment.employeeName} submitted a self review for ${enrollment.cycleLabel}.`,
      recipientEmail: enrollment.managerEmail
    });

    await queueNotification(client, {
      audienceRole: "admin",
      title: "Review progress update",
      body: `${enrollment.employeeName} completed the self review step for ${enrollment.cycleLabel}.`
    });
  } else {
    await queueNotification(client, {
      audienceRole: "employee",
      title: "Manager review submitted",
      body: `Your manager review for ${enrollment.cycleLabel} has been submitted.`,
      recipientEmail: enrollment.employeeEmail
    });

    await queueNotification(client, {
      audienceRole: "admin",
      title: "Manager review completed",
      body: `${enrollment.employeeName} now has a manager review on file for ${enrollment.cycleLabel}.`
    });
  }

  return submissionId;
}

export async function updateDiscussionStatus(
  client: PoolClient,
  session: AppSession,
  input: {
    cycleId: string;
    profileId: string;
    discussionStatus: DiscussionStatus;
  }
) {
  const enrollment = await getEnrollmentContext(client, input.cycleId, input.profileId);

  if (!enrollment) {
    throw new Error("Review enrollment was not found.");
  }

  const allowed = await canManageEnrollment(client, session, enrollment);

  if (!allowed) {
    throw new Error("You do not have permission to update discussion status.");
  }

  const presence = await getSubmissionPresence(client, input.cycleId, input.profileId);

  if (input.discussionStatus === "completed" && !presence.hasManager) {
    throw new Error("Discussion cannot be completed before the manager review is submitted.");
  }

  const nextReviewStatus = deriveEnrollmentReviewStatus({
    hasSelf: presence.hasSelf,
    hasManager: presence.hasManager,
    discussionStatus: input.discussionStatus
  });

  await client.query(
    `
      update public.cycle_enrollments
      set
        discussion_status = $3,
        review_status = $4
      where cycle_id = $1
        and profile_id = $2
    `,
    [input.cycleId, input.profileId, input.discussionStatus, nextReviewStatus]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "cycle_enrollment",
    entityId: enrollment.id,
    action: input.discussionStatus === "scheduled" ? "schedule_discussion" : "complete_discussion",
    summary:
      input.discussionStatus === "scheduled"
        ? `Discussion scheduled for ${enrollment.employeeName} in ${enrollment.cycleLabel}.`
        : `Discussion completed for ${enrollment.employeeName} in ${enrollment.cycleLabel}.`,
    metadata: {
      cycleId: input.cycleId,
      profileId: input.profileId,
      discussionStatus: input.discussionStatus
    }
  });

  await queueNotification(client, {
    audienceRole: "employee",
    title:
      input.discussionStatus === "scheduled"
        ? "Review discussion scheduled"
        : "Review discussion completed",
    body:
      input.discussionStatus === "scheduled"
        ? `Your performance discussion for ${enrollment.cycleLabel} has been scheduled.`
        : `Your performance discussion for ${enrollment.cycleLabel} has been marked complete.`,
    recipientEmail: enrollment.employeeEmail
  });

  await queueNotification(client, {
    audienceRole: "admin",
    title:
      input.discussionStatus === "scheduled"
        ? "Discussion scheduled"
        : "Discussion completed",
    body:
      input.discussionStatus === "scheduled"
        ? `${enrollment.employeeName} now has a scheduled review discussion in ${enrollment.cycleLabel}.`
        : `${enrollment.employeeName} completed the review discussion in ${enrollment.cycleLabel}.`
  });
}
