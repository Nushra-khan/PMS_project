import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { demoWorkspace, profiles } from "@/lib/demo-data";
import { getPendingApprovals } from "@/lib/workflows/dashboard";
import { formatDateTime } from "@/lib/utils";

function getProfileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function GoalApprovalsPage() {
  const session = await requireSession(["manager", "admin"]);
  const pendingApprovals = getPendingApprovals(session);

  return (
    <AppShell
      session={session}
      title="Goal approval queue"
      description="Approval routing, rejection reasons, resubmission history, and turnaround-time discipline are all visible here so the goal workflow can stay auditable."
    >
      <SectionCard
        eyebrow="Queue"
        title="Pending decisions"
        description="These seeded rows mirror the business rules from the PRD: immediate manager notification, Admin fallback, and 5-business-day escalation."
      >
        <DataTable
          headers={["Goal", "Owner", "Status", "Weightage", "Next action"]}
          rows={pendingApprovals.map((goal) => [
            goal.title,
            getProfileName(goal.ownerProfileId),
            <StatusBadge key={`${goal.id}-status`} value={goal.status} />,
            `${goal.weightage}%`,
            goal.status === "draft"
              ? "Coach before submit"
              : "Approve, reject, or escalate"
          ])}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Event log"
        title="Recent approval events"
        description="The event feed is intentionally separate from the goal record so we can preserve submit, approve, reject, resubmit, and archive history."
      >
        <DataTable
          headers={["Action", "Goal", "Actor", "Timestamp", "Notes"]}
          rows={demoWorkspace.goalApprovalEvents.map((event) => [
            <StatusBadge key={`${event.id}-action`} value={event.action} />,
            event.goalId,
            getProfileName(event.actorProfileId),
            formatDateTime(event.createdAt),
            event.notes ?? "No notes"
          ])}
        />
      </SectionCard>
    </AppShell>
  );
}
