import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getReviewsPageData } from "@/lib/db/reviews";
import { formatDate } from "@/lib/utils";

export default async function AdminCyclesPage() {
  const session = await requireSession(["admin"]);
  const { cycles, enrollments } = await getReviewsPageData(session);

  return (
    <AppShell
      session={session}
      title="Admin cycle controls"
      description="This surface is structured for launch readiness, waiver decisions, acting reviewer assignment, and close-window follow-up."
    >
      <SectionCard
        eyebrow="Templates"
        title="Cycle schedule"
        description="The cycle schedule now reads from the live review cycle table so Admin can monitor the actual launch and close windows configured for the workspace."
      >
        {cycles.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No review cycles are configured yet.
          </p>
        ) : (
          <DataTable
            headers={["Cycle", "Track", "Trigger", "Close", "Finalize"]}
            rows={cycles.map((cycle) => [
              cycle.label,
              cycle.cycleType,
              formatDate(cycle.triggerDate),
              formatDate(cycle.closeDate),
              cycle.finalizeFrom ? formatDate(cycle.finalizeFrom) : "N/A"
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Finalization watch"
        title="Enrollment compliance"
        description="Admin can quickly see which employees are still blocked by missing self-reviews, manager reviews, or discussion scheduling."
      >
        {enrollments.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Cycle enrollment compliance will appear here once people are enrolled
            into live review cycles.
          </p>
        ) : (
          <DataTable
            headers={["Employee", "Cycle", "Status", "Discussion", "Manager"]}
            rows={enrollments.map((enrollment) => [
              enrollment.employeeName,
              enrollment.cycleId,
              <StatusBadge
                key={`${enrollment.id}-status`}
                value={enrollment.reviewStatus}
              />,
              <StatusBadge
                key={`${enrollment.id}-discussion`}
                value={enrollment.discussionStatus}
              />,
              enrollment.managerName
            ])}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
