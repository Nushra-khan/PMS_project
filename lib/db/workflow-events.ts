import { PoolClient } from "pg";

import { toNumber } from "@/lib/db/helpers";
import { FlagSeverity, Role } from "@/lib/types";

type NotificationInput = {
  audienceRole: Role;
  title: string;
  body: string;
  recipientEmail?: string | null;
};

type AuditLogInput = {
  actorProfileId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

async function getRedFlagThreshold(client: PoolClient) {
  const result = await client.query<{ red_flag_threshold: string | number }>(
    `
      select red_flag_threshold
      from public.app_settings
      where singleton = true
      limit 1
    `
  );

  return toNumber(result.rows[0]?.red_flag_threshold) || 2;
}

function lowScoreSeverity(score: number, threshold: number): FlagSeverity {
  if (score <= Math.max(1, threshold - 1)) {
    return "high";
  }

  return "medium";
}

export async function queueNotification(
  client: PoolClient,
  input: NotificationInput
) {
  const notificationResult = await client.query<{ id: string }>(
    `
      insert into public.notifications (audience_role, title, body, status)
      values ($1, $2, $3, 'queued')
      returning id
    `,
    [input.audienceRole, input.title, input.body]
  );

  const notificationId = notificationResult.rows[0]?.id;

  if (!notificationId) {
    return null;
  }

  await client.query(
    `
      insert into public.notification_deliveries (notification_id, channel, status)
      values ($1, 'in_app', 'queued')
    `,
    [notificationId]
  );

  if (input.recipientEmail) {
    await client.query(
      `
        insert into public.notification_deliveries (
          notification_id,
          channel,
          recipient_email,
          status
        )
        values ($1, 'email', $2, 'queued')
      `,
      [notificationId, input.recipientEmail]
    );
  }

  return notificationId;
}

export async function insertAuditLog(client: PoolClient, input: AuditLogInput) {
  await client.query(
    `
      insert into public.audit_logs (
        actor_profile_id,
        entity_type,
        entity_id,
        action,
        summary,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.actorProfileId,
      input.entityType,
      input.entityId ?? null,
      input.action,
      input.summary,
      input.metadata ?? {}
    ]
  );
}

export async function maybeCreateFeedbackFlags(
  client: PoolClient,
  input: {
    submissionId: string;
    employeeProfileId: string;
    score: number;
    comments: string;
    requestLabel: string;
  }
) {
  const existingResult = await client.query<{ id: string }>(
    `
      select id
      from public.flags
      where submission_id = $1
      limit 1
    `,
    [input.submissionId]
  );

  if (existingResult.rows[0]) {
    return;
  }

  const threshold = await getRedFlagThreshold(client);

  if (input.score <= threshold) {
    await client.query(
      `
        insert into public.flags (
          submission_id,
          employee_profile_id,
          severity,
          status,
          reason
        )
        values ($1, $2, $3, 'open', $4)
      `,
      [
        input.submissionId,
        input.employeeProfileId,
        lowScoreSeverity(input.score, threshold),
        `${input.requestLabel} scored ${input.score}/5, meeting the configured red-flag threshold (${threshold}/5).`
      ]
    );
  }

  if (input.comments.trim() === "") {
    await client.query(
      `
        insert into public.flags (
          submission_id,
          employee_profile_id,
          severity,
          status,
          reason
        )
        values ($1, $2, 'soft', 'open', $3)
      `,
      [
        input.submissionId,
        input.employeeProfileId,
        `${input.requestLabel} was submitted with a blank open-ended response.`
      ]
    );
  }
}
