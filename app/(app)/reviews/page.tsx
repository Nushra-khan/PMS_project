import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getReviewsPageData } from "@/lib/db/reviews";
import { formatDate } from "@/lib/utils";

export default async function ReviewsPage() {
  const session = await requireSession();
  const { cycles, enrollments } = await getReviewsPageData(session);

  return (
    <AppShell
      session={session}
      title="Performance review cycles"
      description="Bi-annual and quarterly cycles share one review surface with eligibility handling, discussion scheduling, deduplication rules, and escalation checkpoints."
    >
      <SectionCard
        eyebrow="Cycle overview"
        title="Visible cycles"
        description="This page now reads live cycle and enrollment records so review readiness is tied to the actual workspace data."
      >
        {cycles.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No review cycles are visible in this workspace yet.
          </p>
        ) : (
          <DataTable
            headers={["Cycle", "Window", "Trigger", "Close", "Details"]}
            rows={cycles.map((cycle) => [
              cycle.label,
              cycle.goalWindowLabel,
              formatDate(cycle.triggerDate),
              formatDate(cycle.closeDate),
              <Link
                key={cycle.id}
                href={`/reviews/${cycle.id}`}
                className="text-sm font-medium text-tide underline-offset-4 hover:underline"
              >
                Open cycle
              </Link>
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Submission monitor"
        title="Enrollment and discussion state"
        description="Discussion scheduling, self-review progress, and final ratings are kept on the same operational surface."
      >
        {enrollments.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Cycle enrollments will appear here once employees are attached to live
            review cycles.
          </p>
        ) : (
          <DataTable
            headers={["Employee", "Cycle", "Review status", "Discussion", "Manager"]}
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
