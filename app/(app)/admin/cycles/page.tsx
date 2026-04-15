import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { demoWorkspace, profiles } from "@/lib/demo-data";
import { formatDate } from "@/lib/utils";

function profileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function AdminCyclesPage() {
  const session = await requireSession(["admin"]);

  return (
    <AppShell
      session={session}
      title="Admin cycle controls"
      description="This surface is structured for launch readiness, waiver decisions, acting reviewer assignment, and close-window follow-up."
    >
      <SectionCard
        eyebrow="Templates"
        title="Seeded cycle schedule"
        description="The dates match the implementation plan so we can wire activation rules and reminder jobs without reshaping the UI later."
      >
        <DataTable
          headers={["Cycle", "Track", "Trigger", "Close", "Finalize"]}
          rows={demoWorkspace.reviewCycles.map((cycle) => [
            cycle.label,
            cycle.cycleType,
            formatDate(cycle.triggerDate),
            formatDate(cycle.closeDate),
            cycle.finalizeFrom ? formatDate(cycle.finalizeFrom) : "N/A"
          ])}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Finalization watch"
        title="Enrollment compliance"
        description="Admin can quickly see which employees are still blocked by missing self-reviews, manager reviews, or discussion scheduling."
      >
        <DataTable
          headers={["Employee", "Cycle", "Status", "Discussion", "Manager"]}
          rows={demoWorkspace.cycleEnrollments.map((enrollment) => [
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
