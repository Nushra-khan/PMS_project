import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getGoalPageData } from "@/lib/db/goals";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function GoalsPage() {
  const session = await requireSession();
  const { goals, updates } = await getGoalPageData(session);

  return (
    <AppShell
      session={session}
      title="Goal management system"
      description="Company, team, and individual goals share one workspace with approval status, weightage, progress, and historical audit context."
    >
      <SectionCard
        eyebrow="Create and govern"
        title="Goal portfolio"
        description="This portfolio now reads from live PMS goal records so hierarchy, status transitions, approval visibility, and weightage discipline are reflected in the actual workspace."
      >
        <div className="mb-5 flex flex-wrap gap-3">
          <Link
            href="/goals/new"
            className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
          >
            Draft new goal
          </Link>
          {(session.role === "manager" || session.role === "admin") && (
            <Link
              href="/goals/approvals"
              className="rounded-full border border-ink/15 px-5 py-3 text-sm font-medium text-ink transition hover:bg-white/70"
            >
              Review approval queue
            </Link>
          )}
        </div>

        {goals.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No goal records are available yet. Create the first goal to start the
            approval and progress workflow.
          </p>
        ) : (
          <DataTable
            headers={["Goal", "Scope", "Status", "Weightage", "Due date", "Progress"]}
            rows={goals.map((goal) => [
              <div key={`${goal.id}-goal`}>
                <p className="font-medium text-ink">{goal.title}</p>
                <p className="text-xs text-ink/55">{goal.summary}</p>
              </div>,
              goal.scope,
              <StatusBadge key={`${goal.id}-status`} value={goal.status} />,
              `${goal.weightage}%`,
              formatDate(goal.dueDate),
              `${goal.completionPct}%`
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Recent updates"
        title="Progress notes and blockers"
        description="Goal updates are modeled as a first-class feed so reminders, blockers, nudges, and completions remain auditable."
      >
        {updates.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Progress updates will appear here once teams begin posting blockers,
            nudges, and completion notes against live goals.
          </p>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <article
                key={update.id}
                className="rounded-3xl border border-ink/10 bg-white/75 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <StatusBadge value={update.kind} />
                    <p className="mt-2 text-sm font-medium text-ink">
                      {update.goalTitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink/65">{update.postedByName}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/55">
                      {formatDateTime(update.postedAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink/75">{update.body}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
