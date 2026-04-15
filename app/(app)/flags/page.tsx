import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { demoWorkspace, profiles } from "@/lib/demo-data";
import { getAccessibleFlags } from "@/lib/workflows/dashboard";
import { formatDateTime } from "@/lib/utils";

function profileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function FlagsPage() {
  const session = await requireSession(["manager", "admin"]);
  const flags = getAccessibleFlags(session);

  return (
    <AppShell
      session={session}
      title="Feedback and flag review"
      description="Flags are unified across probation and cycle-review submissions so repeat patterns, soft signals, and aged items are visible on one queue."
    >
      <SectionCard
        eyebrow="Review queue"
        title="Open and escalated flags"
        description="The seeded queue already reflects red-flag thresholds, blank-response soft flags, and aging visibility."
      >
        <DataTable
          headers={["Employee", "Severity", "Status", "Reason", "Aged at"]}
          rows={flags.map((flag) => [
            profileName(flag.employeeProfileId),
            <StatusBadge key={`${flag.id}-severity`} value={flag.severity} />,
            <StatusBadge key={`${flag.id}-status`} value={flag.status} />,
            flag.reason,
            formatDateTime(flag.agedAt)
          ])}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Linked submissions"
        title="Feedback context"
        description="Every flag points back to a single submission record so Admin review stays grounded in the original context."
      >
        <DataTable
          headers={["Submission", "Workflow", "Target", "Score", "Comments"]}
          rows={demoWorkspace.feedbackSubmissions.map((submission) => [
            submission.requestLabel,
            submission.workflowType,
            profileName(submission.targetProfileId),
            `${submission.score}/5`,
            submission.comments || "Blank open-ended response"
          ])}
        />
      </SectionCard>
    </AppShell>
  );
}
