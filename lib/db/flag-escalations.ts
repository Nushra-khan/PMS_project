import { PoolClient } from "pg";

import { runAsSystem } from "@/lib/db/helpers";
import { insertAuditLog, queueNotification } from "@/lib/db/workflow-events";

/** Flags with no Admin action for this many days go to the secondary Admin. */
export const FLAG_ESCALATION_DAYS = 7;

type StaleFlagRow = {
  id: string;
  employee_name: string;
  severity: string;
  reason: string;
  aged_at: string | Date;
};

async function getEscalationContact(client: PoolClient) {
  const result = await client.query<{ id: string; email: string; full_name: string }>(
    `
      select profiles.id, profiles.email, profiles.full_name
      from public.app_settings settings
      join public.profiles profiles on profiles.id = settings.secondary_admin_profile_id
      where settings.singleton = true
      limit 1
    `
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  // No secondary contact configured: fall back to any Admin.
  const fallback = await client.query<{ id: string; email: string; full_name: string }>(
    `
      select profiles.id, profiles.email, profiles.full_name
      from public.user_roles roles
      join public.profiles profiles on profiles.id = roles.profile_id
      where roles.role = 'admin'
      order by profiles.full_name asc
      limit 1
    `
  );

  return fallback.rows[0] ?? null;
}

/**
 * Escalates open or under-review flags that no Admin has acted on for
 * FLAG_ESCALATION_DAYS days: marks them escalated, records the action, and
 * notifies the secondary Admin contact.
 */
export async function escalateStaleFlags(client: PoolClient, now = new Date()) {
  const contact = await getEscalationContact(client);

  if (!contact) {
    return 0;
  }

  const cutoff = new Date(now.getTime() - FLAG_ESCALATION_DAYS * 24 * 60 * 60 * 1000);
  const result = await client.query<StaleFlagRow>(
    `
      select
        flags.id,
        employee.full_name as employee_name,
        flags.severity,
        flags.reason,
        flags.aged_at
      from public.flags flags
      join public.profiles employee on employee.id = flags.employee_profile_id
      where flags.status in ('open', 'under_review')
        and flags.aged_at <= $1
        and not exists (
          select 1
          from public.flag_actions actions
          join public.user_roles roles
            on roles.profile_id = actions.actor_profile_id and roles.role = 'admin'
          where actions.flag_id = flags.id
            and actions.created_at > $1
        )
      order by flags.aged_at asc
    `,
    [cutoff]
  );

  for (const flag of result.rows) {
    await client.query(
      `update public.flags set status = 'escalated' where id = $1`,
      [flag.id]
    );
    await client.query(
      `
        insert into public.flag_actions (flag_id, actor_profile_id, action, notes)
        values ($1, $2, 'auto_escalate', $3)
      `,
      [
        flag.id,
        contact.id,
        `No Admin action for ${FLAG_ESCALATION_DAYS} days; escalated to ${contact.full_name}.`
      ]
    );
    await insertAuditLog(client, {
      actorProfileId: contact.id,
      entityType: "flag",
      entityId: flag.id,
      action: "escalate_flag",
      summary: `A ${flag.severity} flag for ${flag.employee_name} had no Admin action for ${FLAG_ESCALATION_DAYS} days and was escalated.`,
      metadata: { agedAt: new Date(flag.aged_at).toISOString() }
    });
    await queueNotification(client, {
      audienceRole: "admin",
      title: "Flag escalated",
      body: `${flag.employee_name}: ${flag.reason} No Admin action in ${FLAG_ESCALATION_DAYS} days.`,
      recipientEmail: contact.email
    });
  }

  return result.rows.length;
}

export async function runFlagEscalations() {
  return runAsSystem<number>(0, (client) => escalateStaleFlags(client));
}
