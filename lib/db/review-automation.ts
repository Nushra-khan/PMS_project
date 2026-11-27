import { PoolClient } from "pg";

import { runAsSystem, toDateOnly } from "@/lib/db/helpers";
import { insertAuditLog, queueNotification } from "@/lib/db/workflow-events";
import {
  isEligibleForCycle,
  reminderStageFor,
  ReminderStage,
  upcomingStandardCycles
} from "@/lib/reviews/schedule";

/** How far ahead standard cycles are created so Admin can review them first. */
const CREATE_DAYS_AHEAD = 30;

export type ReviewAutomationResult = {
  cyclesCreated: number;
  cyclesActivated: number;
  enrolled: number;
  remindersSent: number;
};

const STAGE_COPY: Record<ReminderStage, { title: string; tone: string }> = {
  nudge: { title: "Review reminder", tone: "is open" },
  urgent: { title: "Urgent: review due soon", tone: "closes soon and is still pending" },
  escalation: { title: "Review escalated", tone: "is overdue" }
};

async function getAutomationActor(client: PoolClient) {
  const result = await client.query<{ id: string }>(
    `
      select coalesce(
        (select secondary_admin_profile_id from public.app_settings where singleton = true),
        (select profile_id from public.user_roles where role = 'admin' order by created_at limit 1)
      ) as id
    `
  );

  return result.rows[0]?.id ?? null;
}

/** Creates upcoming standard cycles (inactive) unless one already exists. */
export async function createUpcomingCycles(client: PoolClient, today: string, actorId: string) {
  let created = 0;

  for (const cycle of upcomingStandardCycles(today, CREATE_DAYS_AHEAD)) {
    const result = await client.query<{ id: string }>(
      `
        insert into public.review_cycles (
          label, cycle_type, goal_window_label, trigger_date, close_date, finalize_from, is_active
        )
        select $1, $2::public.cycle_type, $3, $4::date, $5::date, $6::date, false
        where not exists (
          select 1 from public.review_cycles
          where cycle_type = $2::public.cycle_type and trigger_date = $4::date
        )
        returning id
      `,
      [
        cycle.label,
        cycle.cycleType,
        cycle.goalWindowLabel,
        cycle.triggerDate,
        cycle.closeDate,
        cycle.finalizeFrom ?? null
      ]
    );
    const id = result.rows[0]?.id;

    if (id) {
      created += 1;
      await insertAuditLog(client, {
        actorProfileId: actorId,
        entityType: "review_cycle",
        entityId: id,
        action: "auto_create_cycle",
        summary: `${cycle.label} was scheduled automatically for ${cycle.triggerDate}.`
      });
      await queueNotification(client, {
        audienceRole: "admin",
        title: "Review cycle scheduled",
        body: `${cycle.label} opens on ${cycle.triggerDate} and closes on ${cycle.closeDate}. Check the dates and enrollments before it starts.`
      });
    }
  }

  return created;
}

/**
 * Opens cycles whose trigger date has arrived and enrolls everyone eligible:
 * active people on the cycle's review track with a manager, who joined more
 * than 60 days before the cycle closes.
 */
export async function activateDueCycles(client: PoolClient, today: string, actorId: string) {
  const due = await client.query<{
    id: string;
    label: string;
    cycle_type: string;
    close_date: string | Date;
  }>(
    `
      select id, label, cycle_type, close_date
      from public.review_cycles
      where is_active = false and trigger_date <= $1::date and close_date >= $1::date
    `,
    [today]
  );
  let enrolled = 0;

  for (const cycle of due.rows) {
    const closeDate = toDateOnly(cycle.close_date) ?? today;
    await client.query("update public.review_cycles set is_active = true where id = $1", [cycle.id]);

    const people = await client.query<{
      id: string;
      date_of_joining: string | Date;
      manager_profile_id: string | null;
      email: string;
    }>(
      `
        select id, date_of_joining, manager_profile_id, email
        from public.profiles
        where is_active and review_track::text = $1 and manager_profile_id is not null
      `,
      [cycle.cycle_type]
    );
    let cycleEnrolled = 0;

    for (const person of people.rows) {
      if (!isEligibleForCycle(toDateOnly(person.date_of_joining) ?? today, closeDate)) {
        continue;
      }

      const inserted = await client.query(
        `
          insert into public.cycle_enrollments (cycle_id, profile_id, manager_profile_id)
          values ($1, $2, $3)
          on conflict (cycle_id, profile_id) do nothing
        `,
        [cycle.id, person.id, person.manager_profile_id]
      );

      if (inserted.rowCount) {
        cycleEnrolled += 1;
        await queueNotification(client, {
          audienceRole: "employee",
          title: "Your review cycle is open",
          body: `${cycle.label} is open. Submit your self review by ${closeDate}.`,
          recipientEmail: person.email
        });
      }
    }

    enrolled += cycleEnrolled;
    await insertAuditLog(client, {
      actorProfileId: actorId,
      entityType: "review_cycle",
      entityId: cycle.id,
      action: "auto_activate_cycle",
      summary: `${cycle.label} opened automatically with ${cycleEnrolled} new enrollment(s).`,
      metadata: { enrolled: cycleEnrolled }
    });
  }

  return { activated: due.rows.length, enrolled };
}

/**
 * Sends the 5th / 15th / 22nd day reminders for reviews still pending in
 * active cycles. Each stage goes out once per enrollment; the 22nd-day stage
 * also alerts Admin.
 */
export async function sendCycleReminders(client: PoolClient, today: string, actorId: string) {
  const pending = await client.query<{
    enrollment_id: string;
    cycle_label: string;
    trigger_date: string | Date;
    close_date: string | Date;
    employee_name: string;
    employee_email: string;
    manager_email: string;
    self_done: boolean;
    manager_done: boolean;
    sent_actions: string[] | null;
  }>(
    `
      select
        enrollments.id as enrollment_id,
        cycles.label as cycle_label,
        cycles.trigger_date,
        cycles.close_date,
        employee.full_name as employee_name,
        employee.email as employee_email,
        manager.email as manager_email,
        exists (
          select 1 from public.review_submissions s
          where s.cycle_id = cycles.id and s.profile_id = enrollments.profile_id
            and s.submission_type = 'self_review' and s.submitted_at is not null
        ) as self_done,
        exists (
          select 1 from public.review_submissions s
          where s.cycle_id = cycles.id and s.profile_id = enrollments.profile_id
            and s.submission_type = 'manager_review' and s.submitted_at is not null
        ) as manager_done,
        (
          select array_agg(logs.action)
          from public.audit_logs logs
          where logs.entity_type = 'cycle_enrollment' and logs.entity_id = enrollments.id
            and logs.action like 'review_reminder_%'
        ) as sent_actions
      from public.cycle_enrollments enrollments
      join public.review_cycles cycles on cycles.id = enrollments.cycle_id
      join public.profiles employee on employee.id = enrollments.profile_id
      join public.profiles manager on manager.id = enrollments.manager_profile_id
      where cycles.is_active
        and cycles.trigger_date <= $1::date
        and enrollments.review_status not in ('submitted', 'waived', 'finalized')
    `,
    [today]
  );
  let sent = 0;

  for (const row of pending.rows) {
    const stage = reminderStageFor(toDateOnly(row.trigger_date) ?? today, today);
    const action = `review_reminder_${stage}`;

    if (!stage || (row.sent_actions ?? []).includes(action) || (row.self_done && row.manager_done)) {
      continue;
    }

    const copy = STAGE_COPY[stage];
    const closeDate = toDateOnly(row.close_date);

    if (!row.self_done) {
      await queueNotification(client, {
        audienceRole: "employee",
        title: copy.title,
        body: `Your self review for ${row.cycle_label} ${copy.tone}. It closes on ${closeDate}.`,
        recipientEmail: row.employee_email
      });
    }

    if (!row.manager_done) {
      await queueNotification(client, {
        audienceRole: "manager",
        title: copy.title,
        body: `Your review of ${row.employee_name} for ${row.cycle_label} ${copy.tone}. It closes on ${closeDate}.`,
        recipientEmail: row.manager_email
      });
    }

    if (stage === "escalation") {
      await queueNotification(client, {
        audienceRole: "admin",
        title: "Review escalated",
        body: `${row.employee_name}'s review for ${row.cycle_label} is still pending (${[
          row.self_done ? null : "self review",
          row.manager_done ? null : "manager review"
        ]
          .filter(Boolean)
          .join(" and ")}).`
      });
    }

    await insertAuditLog(client, {
      actorProfileId: actorId,
      entityType: "cycle_enrollment",
      entityId: row.enrollment_id,
      action,
      summary: `${copy.title} sent for ${row.employee_name} in ${row.cycle_label}.`
    });
    sent += 1;
  }

  return sent;
}

export async function runReviewCycleAutomationWith(client: PoolClient, today: string) {
  const actorId = await getAutomationActor(client);

  if (!actorId) {
    return { cyclesCreated: 0, cyclesActivated: 0, enrolled: 0, remindersSent: 0 };
  }

  const cyclesCreated = await createUpcomingCycles(client, today, actorId);
  const { activated, enrolled } = await activateDueCycles(client, today, actorId);
  const remindersSent = await sendCycleReminders(client, today, actorId);

  return { cyclesCreated, cyclesActivated: activated, enrolled, remindersSent };
}

export async function runReviewCycleAutomation(today = new Date().toISOString().slice(0, 10)) {
  return runAsSystem<ReviewAutomationResult>(
    { cyclesCreated: 0, cyclesActivated: 0, enrolled: 0, remindersSent: 0 },
    (client) => runReviewCycleAutomationWith(client, today)
  );
}
