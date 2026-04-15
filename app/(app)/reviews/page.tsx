import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { demoWorkspace, profiles } from "@/lib/demo-data";
import { getAccessibleCycles } from "@/lib/workflows/dashboard";
import { formatDate } from "@/lib/utils";

function profileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function ReviewsPage() {
  const session = await requireSession();
  const cycles = getAccessibleCycles(session);

  return (
    <AppShell
      session={session}
      title="Performance review cycles"
      description="Bi-annual and quarterly cycles share one review surface with eligibility handling, discussion scheduling, deduplication rules, and escalation checkpoints."
    >
      <SectionCard
        eyebrow="Cycle overview"
        title="Visible cycles"
        description="The page structure already accounts for cycle activation readiness, reminder cadence, and acting-reviewer support."
      >
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
      </SectionCard>

      <SectionCard
        eyebrow="Submission monitor"
        title="Enrollment and discussion state"
        description="Discussion scheduling, self-review progress, and final ratings are kept on the same operational surface."
      >
        <DataTable
          headers={["Employee", "Cycle", "Review status", "Discussion", "Manager"]}
          rows={demoWorkspace.cycleEnrollments
            .filter((enrollment) => cycles.some((cycle) => cycle.id === enrollment.cycleId))
            .map((enrollment) => [
              profileName(enrollment.profileId),
              enrollment.cycleId,
              <StatusBadge
                key={`${enrollment.id}-status`}
                value={enrollment.reviewStatus}
              />,
              <StatusBadge
                key={`${enrollment.id}-discussion`}
                value={enrollment.discussionStatus}
              />,
              profileName(enrollment.managerProfileId)
            ])}
        />
      </SectionCard>
    </AppShell>
  );
}
