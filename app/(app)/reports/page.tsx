import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getReportsPageData, reportDatasets } from "@/lib/db/reports";
import { formatDate, formatDateTime } from "@/lib/utils";

const exportLabels: Record<(typeof reportDatasets)[number], string> = {
  goals: "Goals CSV",
  reviews: "Reviews CSV",
  probation: "Probation CSV",
  flags: "Flags CSV",
  audit: "Audit CSV"
};

export default async function ReportsPage() {
  const session = await requireSession();
  const reports = await getReportsPageData(session);

  return (
    <AppShell
      session={session}
      title="Reporting and exports"
      description="Role-aware operational reports for goals, review cycles, probation, red flags, and audit activity with CSV downloads for offline HR review."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reports.stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            description={stat.description}
          />
        ))}
      </section>

      <SectionCard
        eyebrow="Downloads"
        title="Export center"
        description="Each export respects the signed-in user's role scope: Admin gets the workspace view, managers get their team view, and employees get their own records."
      >
        <div className="flex flex-wrap gap-3">
          {reportDatasets.map((dataset) => (
            <Link
              key={dataset}
              href={`/reports/export/${dataset}`}
              className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
            >
              {exportLabels[dataset]}
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Goal report"
        title="Goal health export preview"
        description="A compact preview of goal ownership, weightage, due dates, status, and completion before downloading the full CSV."
      >
        {reports.goals.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No goal records are available for your report scope yet.
          </p>
        ) : (
          <DataTable
            headers={["Goal", "Owner", "Status", "Weightage", "Due date", "Progress"]}
            rows={reports.goals.slice(0, 8).map((goal) => [
              goal.title,
              goal.ownerName,
              <StatusBadge key={`${goal.title}-status`} value={goal.status} />,
              `${goal.weightage}%`,
              formatDate(goal.dueDate),
              `${goal.completionPct}%`
            ])}
          />
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="Review report"
          title="Cycle readiness"
          description="Review enrollment status, discussion status, and final rating coverage."
        >
          {reports.reviews.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
              No review enrollments are available for your report scope.
            </p>
          ) : (
            <DataTable
              headers={["Employee", "Cycle", "Review", "Discussion"]}
              rows={reports.reviews.slice(0, 6).map((review) => [
                review.employeeName,
                review.cycleLabel,
                <StatusBadge key={`${review.employeeName}-review`} value={review.reviewStatus} />,
                <StatusBadge key={`${review.employeeName}-discussion`} value={review.discussionStatus} />
              ])}
            />
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Probation report"
          title="Checkpoint completion"
          description="Probation status, confirmation-call timing, and shared feedback coverage."
        >
          {reports.probation.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
              No probation cases are available for your report scope.
            </p>
          ) : (
            <DataTable
              headers={["Employee", "Status", "Call", "Shared"]}
              rows={reports.probation.slice(0, 6).map((entry) => [
                entry.employeeName,
                <StatusBadge key={`${entry.employeeName}-probation`} value={entry.status} />,
                entry.confirmationCallDate ? formatDate(entry.confirmationCallDate) : "Not set",
                `${entry.checkpointsShared}/${entry.checkpointsTotal}`
              ])}
            />
          )}
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Risk report"
        title="Flags and audit trail"
        description="Open feedback flags and recent audit entries are exported separately, with a short preview here for quick operational review."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">
              Flags
            </p>
            {reports.flags.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
                No flags are available for your report scope.
              </p>
            ) : (
              <DataTable
                headers={["Employee", "Severity", "Status"]}
                rows={reports.flags.slice(0, 5).map((flag) => [
                  flag.employeeName,
                  <StatusBadge key={`${flag.employeeName}-severity`} value={flag.severity} />,
                  <StatusBadge key={`${flag.employeeName}-flag-status`} value={flag.status} />
                ])}
              />
            )}
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">
              Audit
            </p>
            {reports.audit.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
                No audit entries are available for your report scope.
              </p>
            ) : (
              <DataTable
                headers={["Action", "Actor", "When"]}
                rows={reports.audit.slice(0, 5).map((entry) => [
                  <StatusBadge key={`${entry.createdAt}-action`} value={entry.action} />,
                  entry.actorName,
                  formatDateTime(entry.createdAt)
                ])}
              />
            )}
          </div>
        </div>
      </SectionCard>
    </AppShell>
  );
}
