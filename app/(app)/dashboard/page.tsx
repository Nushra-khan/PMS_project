import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getDashboardPageData } from "@/lib/db/dashboard";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const dashboard = await getDashboardPageData(session);

  return (
    <AppShell
      session={session}
      title="Live performance operations"
      description="One role-aware cockpit for live goal health, probation compliance, review readiness, flagged responses, and auditable operational work."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.stats.map((stat) => (
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
          description="Active goals stay visible with due dates, completion percentages, and approval state so the same dashboard can support employee, manager, and Admin decision-making in real time."
        >
          {dashboard.goals.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
              No goals are available in this workspace yet. Once goal records are
              created and approved, live health tracking will appear here.
            </p>
          ) : (
            <DataTable
              headers={["Goal", "Owner", "Status", "Progress", "Days left"]}
              rows={dashboard.goals.map((goal) => [
                <div key={`${goal.id}-title`}>
                  <p className="font-medium text-ink">{goal.title}</p>
                  <p className="text-xs text-ink/55">{goal.summary}</p>
                </div>,
                session.role === "employee" ? "Me" : goal.ownerName,
                <StatusBadge key={`${goal.id}-status`} value={goal.status} />,
                `${goal.completionPct}%`,
                String(goal.daysLeft)
              ])}
            />
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Notification feed"
          title="Automation queue"
          description="Approval updates, reminders, and escalations now read from the live notification queue."
        >
          {dashboard.notifications.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
              No live notifications have been created for this role yet.
            </p>
          ) : (
            <div className="space-y-4">
              {dashboard.notifications.map((notification) => (
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
          )}
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Audit trail"
        title="Recent workflow activity"
        description="Approvals, flag reviews, and blocked checkpoints are surfaced as auditable events from day one."
      >
        {dashboard.auditTrail.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Audit activity will appear here after users start creating and resolving
            live workflow records.
          </p>
        ) : (
          <DataTable
            headers={["Action", "Entity", "Summary", "Timestamp"]}
            rows={dashboard.auditTrail.map((entry) => [
              <StatusBadge key={`${entry.id}-action`} value={entry.action} />,
              `${entry.entityType} / ${entry.entityId}`,
              entry.summary,
              formatDateTime(entry.createdAt)
            ])}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
