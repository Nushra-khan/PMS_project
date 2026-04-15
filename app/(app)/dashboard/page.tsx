import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import {
  getDashboardStats,
  getGoalHealth,
  getHomeFeed,
  getRecentAuditTrail
} from "@/lib/workflows/dashboard";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const stats = getDashboardStats(session);
  const goalHealth = getGoalHealth(session);
  const notifications = getHomeFeed(session);
  const auditTrail = getRecentAuditTrail(session);

  return (
    <AppShell
      session={session}
      title="Live performance operations"
      description="This seeded dashboard aligns to the project goal: one role-aware cockpit for goal health, probation compliance, review readiness, flagged responses, and auditable operational work."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            description={stat.description}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          eyebrow="Goal health"
          title="Execution view"
          description="Active goals stay visible with due dates, completion percentages, and approval state so the same dashboard can support employee, manager, and Admin decision-making."
        >
          <DataTable
            headers={["Goal", "Owner", "Status", "Progress", "Days left"]}
            rows={goalHealth.map((goal) => [
              <div key={`${goal.id}-title`}>
                <p className="font-medium text-ink">{goal.title}</p>
                <p className="text-xs text-ink/55">{goal.summary}</p>
              </div>,
              session.role === "employee" ? "Me" : goal.ownerProfileId,
              <StatusBadge key={`${goal.id}-status`} value={goal.status} />,
              `${goal.completionPct}%`,
              String(goal.daysLeft)
            ])}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Notification feed"
          title="Automation queue"
          description="The seeded feed mirrors the platform's reminder, escalation, and approval-notification model."
        >
          <div className="space-y-4">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className="rounded-3xl border border-ink/10 bg-white/70 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-ink">{notification.title}</p>
                  <StatusBadge value={notification.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  {notification.body}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Audit trail"
        title="Recent workflow activity"
        description="Approvals, flag reviews, and blocked checkpoints are surfaced as auditable events from day one."
      >
        <DataTable
          headers={["Action", "Entity", "Summary", "Timestamp"]}
          rows={auditTrail.map((entry) => [
            <StatusBadge key={`${entry.id}-action`} value={entry.action} />,
            `${entry.entityType} / ${entry.entityId}`,
            entry.summary,
            formatDateTime(entry.createdAt)
          ])}
        />
      </SectionCard>
    </AppShell>
  );
}
