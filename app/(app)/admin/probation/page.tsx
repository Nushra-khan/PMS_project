import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { probationCases, probationCheckpoints, profiles } from "@/lib/demo-data";
import { formatDate } from "@/lib/utils";

function profileName(profileId?: string) {
  if (!profileId) {
    return "Unassigned";
  }

  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function AdminProbationPage() {
  const session = await requireSession(["admin"]);

  return (
    <AppShell
      session={session}
      title="Admin probation operations"
      description="Blocked triggers, paused clocks, revised due dates, and confirmation-prep work all sit on one Admin-first surface."
    >
      <SectionCard
        eyebrow="Case status"
        title="Probation case oversight"
        description="Paused leave handling, missing-manager blockers, and final call prep are modeled explicitly to match the project goal."
      >
        <DataTable
          headers={["Employee", "Manager", "Case status", "Confirmation call", "Admin owner"]}
          rows={probationCases.map((probationCase) => [
            profileName(probationCase.profileId),
            profileName(probationCase.managerProfileId),
            <StatusBadge
              key={`${probationCase.id}-status`}
              value={probationCase.status}
            />,
            formatDate(probationCase.confirmationCallDate),
            profileName(probationCase.adminOwnerProfileId)
          ])}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Checkpoint detail"
        title="Checkpoint and cross-share status"
        description="Admin can see the exact state of each Day 30, Day 60, and Day 80 workflow before deciding whether to waive, reassign, or escalate."
      >
        <DataTable
          headers={["Checkpoint", "Case", "Status", "Due date", "Revised due date"]}
          rows={probationCheckpoints.map((checkpoint) => [
            checkpoint.formTitle,
            checkpoint.caseId,
            <StatusBadge key={`${checkpoint.id}-status`} value={checkpoint.status} />,
            formatDate(checkpoint.dueDate),
            formatDate(checkpoint.revisedDueDate)
          ])}
        />
      </SectionCard>
    </AppShell>
  );
}
