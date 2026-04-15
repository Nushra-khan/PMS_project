import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { profiles } from "@/lib/demo-data";
import { getProbationCases } from "@/lib/workflows/dashboard";
import {
  getCheckpointsForCase,
  getProbationTimeline
} from "@/lib/workflows/probation";
import { formatDate } from "@/lib/utils";

function profileName(profileId?: string) {
  if (!profileId) {
    return "Unassigned";
  }

  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function ProbationPage() {
  const session = await requireSession();
  const cases = getProbationCases(session);

  return (
    <AppShell
      session={session}
      title="Probation monitoring"
      description="Day 30, Day 60, and Day 80 checkpoints are treated as operational workflows with working-day calculation, leave-aware pauses, cross-share logic, and escalation visibility."
    >
      <SectionCard
        eyebrow="Case monitor"
        title="Active and historical probation cases"
        description="This view is already organized around the edge cases from the plan: paused clocks, blocked triggers, manager reassignment, and read-only checkpoint history."
      >
        <div className="space-y-6">
          {cases.map((probationCase) => {
            const employee = profiles.find(
              (profile) => profile.id === probationCase.profileId
            );
            const checkpoints = getCheckpointsForCase(probationCase.id);
            const timeline = getProbationTimeline(probationCase.profileId);

            return (
              <article
                key={probationCase.id}
                className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold text-ink">{employee?.name}</p>
                    <p className="text-sm text-ink/65">
                      Manager: {profileName(probationCase.managerProfileId)} •
                      Confirmation call: {formatDate(probationCase.confirmationCallDate)}
                    </p>
                  </div>
                  <StatusBadge value={probationCase.status} />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-ink/10 bg-panel/80 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tide">
                      Timeline
                    </p>
                    <div className="mt-3 space-y-3">
                      {timeline.map((item) => (
                        <div key={item.label} className="rounded-2xl bg-white px-4 py-3">
                          <p className="font-medium text-ink">{item.label}</p>
                          <p className="text-sm text-ink/65">{formatDate(item.date.toISOString())}</p>
                          <p className="text-sm text-ink/65">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-ink/10 bg-panel/80 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tide">
                      Checkpoint status
                    </p>
                    <div className="mt-3 space-y-3">
                      {checkpoints.map((checkpoint) => (
                        <div key={checkpoint.id} className="rounded-2xl bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-ink">{checkpoint.formTitle}</p>
                            <StatusBadge value={checkpoint.status} />
                          </div>
                          <p className="mt-2 text-sm text-ink/65">
                            Due: {formatDate(checkpoint.dueDate)}
                            {checkpoint.revisedDueDate
                              ? ` • Revised: ${formatDate(checkpoint.revisedDueDate)}`
                              : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>
    </AppShell>
  );
}
