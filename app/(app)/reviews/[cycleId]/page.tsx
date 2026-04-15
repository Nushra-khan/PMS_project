import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { profiles, reviewSubmissions } from "@/lib/demo-data";
import {
  getCycleById,
  getCycleEnrollments
} from "@/lib/workflows/dashboard";
import { formatDate, titleCase } from "@/lib/utils";

function profileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function CycleDetailPage({
  params
}: {
  params: { cycleId: string };
}) {
  const session = await requireSession();
  const cycle = getCycleById(params.cycleId);

  if (!cycle) {
    notFound();
  }

  const enrollments = getCycleEnrollments(cycle.id);
  const submissions = reviewSubmissions.filter(
    (submission) => submission.cycleId === cycle.id
  );

  return (
    <AppShell
      session={session}
      title={cycle.label}
      description="Cycle detail is organized around close dates, enrollment state, submission progress, and finalization readiness."
    >
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard
          eyebrow="Cycle frame"
          title="Key dates"
          description="These values are seeded from the cycle template plan and will become Admin-editable controls later."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-ink/10 bg-white/75 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">Window</p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {cycle.goalWindowLabel}
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/75 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">Trigger</p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {formatDate(cycle.triggerDate)}
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/75 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">Close</p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {formatDate(cycle.closeDate)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Participant readiness"
          title="Enrollment and rating detail"
          description="Employees, managers, and Admin can all understand who is waiting on what before finalization."
        >
          <DataTable
            headers={["Employee", "Review status", "Discussion", "Final rating"]}
            rows={enrollments.map((enrollment) => [
              profileName(enrollment.profileId),
              <StatusBadge
                key={`${enrollment.id}-status`}
                value={enrollment.reviewStatus}
              />,
              <StatusBadge
                key={`${enrollment.id}-discussion`}
                value={enrollment.discussionStatus}
              />,
              enrollment.finalRating ? titleCase(enrollment.finalRating) : "Pending"
            ])}
          />

          <div className="mt-5">
            <DataTable
              headers={["Submission type", "Profile", "Status", "Timestamp"]}
              rows={submissions.map((submission) => [
                titleCase(submission.submissionType),
                profileName(submission.profileId),
                <StatusBadge
                  key={`${submission.id}-submission`}
                  value={submission.status}
                />,
                formatDate(submission.submittedAt)
              ])}
            />
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
