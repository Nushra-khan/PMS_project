import { PoolClient } from "pg";

import { env } from "@/lib/env";
import { getEmailProvider, sendEmail } from "@/lib/email/send";
import { runWithClient, toNumber } from "@/lib/db/helpers";
import { getDbClient, getDbPool } from "@/lib/db/pool";
import { runGoalApprovalEscalations } from "@/lib/db/goals";
import { syncProbationAutomation } from "@/lib/db/probation";

const MAX_EMAIL_RETRIES = 3;

type DeliveryRow = {
  id: string;
  notification_id: string;
  recipient_email: string;
  retry_count: number | string;
  title: string;
  body: string;
};

type NotificationDeliveryResult = {
  provider: "resend" | "smtp" | "not_configured";
  inAppMarkedSent: number;
  emailSent: number;
  emailFailed: number;
  emailSkipped: number;
};

export type AutomationRunResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  probationAutomation: "completed" | "skipped";
  goalEscalations: "completed" | "skipped";
  deliveries: NotificationDeliveryResult;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notificationHtml(row: DeliveryRow) {
  return [
    `<h2>${escapeHtml(row.title)}</h2>`,
    `<p>${escapeHtml(row.body).replaceAll("\n", "<br />")}</p>`,
    `<p><a href="${escapeHtml(env.appUrl)}">Open PMS Pro</a></p>`
  ].join("\n");
}

async function markInAppDeliveriesSent(client: PoolClient) {
  const result = await client.query<{ id: string }>(
    `
      update public.notification_deliveries
      set
        status = 'sent',
        last_error = null
      where channel = 'in_app'
        and status = 'queued'
      returning id
    `
  );

  return result.rows.length;
}

async function markInvalidEmailDeliveriesFailed(client: PoolClient) {
  await client.query(
    `
      update public.notification_deliveries
      set
        status = 'failed',
        retry_count = retry_count + 1,
        last_error = 'Missing recipient email.'
      where channel = 'email'
        and status = 'queued'
        and (recipient_email is null or trim(recipient_email) = '')
    `
  );
}

async function getPendingEmailDeliveryCount(client: PoolClient) {
  const result = await client.query<{ count: string | number }>(
    `
      select count(*) as count
      from public.notification_deliveries
      where channel = 'email'
        and status in ('queued', 'failed')
        and retry_count < $1
        and recipient_email is not null
        and trim(recipient_email) <> ''
    `,
    [MAX_EMAIL_RETRIES]
  );

  return toNumber(result.rows[0]?.count);
}

async function getPendingEmailDeliveries(client: PoolClient) {
  const result = await client.query<DeliveryRow>(
    `
      select
        deliveries.id,
        deliveries.notification_id,
        deliveries.recipient_email,
        deliveries.retry_count,
        notifications.title,
        notifications.body
      from public.notification_deliveries deliveries
      join public.notifications notifications on notifications.id = deliveries.notification_id
      where deliveries.channel = 'email'
        and deliveries.status in ('queued', 'failed')
        and deliveries.retry_count < $1
        and deliveries.recipient_email is not null
        and trim(deliveries.recipient_email) <> ''
      order by deliveries.created_at asc
      limit $2
    `,
    [MAX_EMAIL_RETRIES, Math.max(1, env.emailBatchSize)]
  );

  return result.rows;
}

async function markEmailDeliverySent(client: PoolClient, deliveryId: string) {
  await client.query(
    `
      update public.notification_deliveries
      set
        status = 'sent',
        last_error = null
      where id = $1
    `,
    [deliveryId]
  );
}

async function markEmailDeliveryFailed(
  client: PoolClient,
  deliveryId: string,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Email delivery failed.";

  await client.query(
    `
      update public.notification_deliveries
      set
        status = 'failed',
        retry_count = retry_count + 1,
        last_error = $2
      where id = $1
    `,
    [deliveryId, message.slice(0, 500)]
  );
}

async function refreshNotificationStatuses(client: PoolClient) {
  await client.query(
    `
      update public.notifications notifications
      set
        status = 'sent',
        sent_at = coalesce(notifications.sent_at, timezone('utc', now()))
      where exists (
        select 1
        from public.notification_deliveries deliveries
        where deliveries.notification_id = notifications.id
      )
        and not exists (
          select 1
          from public.notification_deliveries deliveries
          where deliveries.notification_id = notifications.id
            and deliveries.status <> 'sent'
        )
    `
  );

  await client.query(
    `
      update public.notifications notifications
      set status = 'failed'
      where exists (
        select 1
        from public.notification_deliveries deliveries
        where deliveries.notification_id = notifications.id
          and deliveries.status = 'failed'
          and deliveries.retry_count >= $1
      )
        and not exists (
          select 1
          from public.notification_deliveries deliveries
          where deliveries.notification_id = notifications.id
            and deliveries.status = 'queued'
        )
    `,
    [MAX_EMAIL_RETRIES]
  );
}

async function processNotificationDeliveries() {
  return runWithClient<NotificationDeliveryResult>(
    {
      provider: "not_configured",
      inAppMarkedSent: 0,
      emailSent: 0,
      emailFailed: 0,
      emailSkipped: 0
    },
    async (client) => {
      const inAppMarkedSent = await markInAppDeliveriesSent(client);
      await markInvalidEmailDeliveriesFailed(client);

      const provider = getEmailProvider();

      if (!provider) {
        const emailSkipped = await getPendingEmailDeliveryCount(client);
        await refreshNotificationStatuses(client);

        return {
          provider: "not_configured",
          inAppMarkedSent,
          emailSent: 0,
          emailFailed: 0,
          emailSkipped
        };
      }

      const deliveries = await getPendingEmailDeliveries(client);
      let emailSent = 0;
      let emailFailed = 0;

      for (const delivery of deliveries) {
        try {
          await sendEmail({
            to: delivery.recipient_email,
            subject: delivery.title,
            text: delivery.body,
            html: notificationHtml(delivery)
          });
          await markEmailDeliverySent(client, delivery.id);
          emailSent += 1;
        } catch (error) {
          await markEmailDeliveryFailed(client, delivery.id, error);
          emailFailed += 1;
        }
      }

      await refreshNotificationStatuses(client);

      return {
        provider,
        inAppMarkedSent,
        emailSent,
        emailFailed,
        emailSkipped: 0
      };
    }
  );
}

export async function runAutomationWorker(): Promise<AutomationRunResult> {
  const startedAt = new Date().toISOString();
  const db = getDbPool();

  if (!db) {
    return {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      probationAutomation: "skipped",
      goalEscalations: "skipped",
      deliveries: {
        provider: "not_configured",
        inAppMarkedSent: 0,
        emailSent: 0,
        emailFailed: 0,
        emailSkipped: 0
      }
    };
  }

  const healthCheckClient = await getDbClient();

  if (!healthCheckClient) {
    return {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      probationAutomation: "skipped",
      goalEscalations: "skipped",
      deliveries: {
        provider: "not_configured",
        inAppMarkedSent: 0,
        emailSent: 0,
        emailFailed: 0,
        emailSkipped: 0
      }
    };
  }

  healthCheckClient.release();

  await syncProbationAutomation();
  await runGoalApprovalEscalations();
  const deliveries = await processNotificationDeliveries();

  return {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    probationAutomation: "completed",
    goalEscalations: "completed",
    deliveries
  };
}
