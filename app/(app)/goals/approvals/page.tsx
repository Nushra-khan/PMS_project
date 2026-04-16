import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { resolveGoalApprovalAction } from "@/app/(app)/goals/actions";
import { requireSession } from "@/lib/auth/session";
import { getGoalApprovalPageData } from "@/lib/db/goals";
import { formatDateTime } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function GoalApprovalsPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession(["manager", "admin"]);
  const { pendingApprovals, events } = await getGoalApprovalPageData(session);
  const status = searchParams?.status;
  const message = searchParams?.message;

  return (
    <AppShell
      session={session}
      title="Goal approval queue"
      description="Approval routing, rejection reasons, resubmission history, and turnaround-time discipline are all visible here so the goal workflow can stay auditable."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Queue"
        title="Pending decisions"
        description="These rows are now live approval candidates from the PMS goal table, including drafts and pending submissions that need manager or Admin action."
      >
        {pendingApprovals.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No goals are waiting for review right now.
          </p>
        ) : (
          <DataTable
            headers={["Goal", "Owner", "Status", "Weightage", "Decision"]}
            rows={pendingApprovals.map((goal) => [
              <div key={`${goal.id}-goal`}>
                <p className="font-medium text-ink">{goal.title}</p>
                <p className="text-xs text-ink/55">{goal.summary}</p>
              </div>,
              goal.ownerName,
              <StatusBadge key={`${goal.id}-status`} value={goal.status} />,
              `${goal.weightage}%`,
              <form
                key={`${goal.id}-form`}
                action={resolveGoalApprovalAction}
                className="grid gap-2"
              >
                <input type="hidden" name="goalId" value={goal.id} />
                <input
                  name="weightage"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={goal.weightage}
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Weightage"
                />
                <input
                  name="notes"
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Approval notes"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="intent"
                    value="approve"
                    className="rounded-full bg-ink px-3 py-2 text-xs font-medium text-white transition hover:bg-tide"
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="reject"
                    className="rounded-full border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition hover:bg-white/75"
                  >
                    Send back
                  </button>
                </div>
              </form>
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Event log"
        title="Recent approval events"
        description="The event feed is intentionally separate from the goal record so we can preserve submit, approve, reject, resubmit, and archive history."
      >
        {events.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Approval history will appear here once goals start moving through the
            live workflow.
          </p>
        ) : (
          <DataTable
            headers={["Action", "Goal", "Actor", "Timestamp", "Notes"]}
            rows={events.map((event) => [
              <StatusBadge key={`${event.id}-action`} value={event.action} />,
              event.goalTitle,
              event.actorName,
              formatDateTime(event.createdAt),
              event.notes ?? "No notes"
            ])}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
