import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { submitProbationFeedbackAction } from "@/app/(app)/probation/actions";
import { requireSession } from "@/lib/auth/session";
import { getProbationPageData } from "@/lib/db/probation";
import { formatDate, titleCase } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function ProbationPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession();
  const { cases } = await getProbationPageData(session);
  const status = searchParams?.status;
  const message = searchParams?.message;

  return (
    <AppShell
      session={session}
      title="Probation monitoring"
      description="Day 30, Day 60, and Day 80 checkpoints are treated as operational workflows with working-day calculation, leave-aware pauses, cross-share logic, and escalation visibility."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Case monitor"
        title="Active and historical probation cases"
        description="This view now includes live feedback submission, shared checkpoint visibility, and checkpoint-specific operational actions."
      >
        {cases.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No probation cases are visible in this workspace yet.
          </p>
        ) : (
          <div className="space-y-6">
            {cases.map((probationCase) => (
              <article
                key={probationCase.id}
                className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold text-ink">
                      {probationCase.employeeName}
                    </p>
                    <p className="text-sm text-ink/65">
                      Manager: {probationCase.managerName} / Confirmation call:{" "}
                      {formatDate(probationCase.confirmationCallDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={probationCase.status} />
                    {probationCase.latestDecision ? (
                      <StatusBadge value={probationCase.latestDecision.decision} />
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-ink/10 bg-panel/80 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tide">
                      Timeline
                    </p>
                    <div className="mt-3 space-y-3">
                      {probationCase.timeline.map((item) => (
                        <div key={item.label} className="rounded-2xl bg-white px-4 py-3">
                          <p className="font-medium text-ink">{item.label}</p>
                          <p className="text-sm text-ink/65">
                            {formatDate(item.date.toISOString())}
                          </p>
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
                      {probationCase.checkpoints.map((checkpoint) => {
                        const employeeSubmission = checkpoint.submissions.find(
                          (submission) => submission.submittedByRole === "employee"
                        );
                        const managerSubmission = checkpoint.submissions.find(
                          (submission) => submission.submittedByRole === "manager"
                        );
                        const canSubmitEmployee =
                          session.userId === probationCase.profileId &&
                          !employeeSubmission &&
                          checkpoint.status !== "blocked" &&
                          checkpoint.status !== "waived" &&
                          checkpoint.status !== "cancelled";
                        const canSubmitManager =
                          probationCase.managerProfileId === session.userId &&
                          !managerSubmission &&
                          checkpoint.status !== "blocked" &&
                          checkpoint.status !== "waived" &&
                          checkpoint.status !== "cancelled";

                        return (
                          <div
                            key={checkpoint.id}
                            className="rounded-2xl bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-ink">{checkpoint.formTitle}</p>
                              <StatusBadge value={checkpoint.status} />
                            </div>
                            <p className="mt-2 text-sm text-ink/65">
                              Due: {formatDate(checkpoint.dueDate)}
                              {checkpoint.revisedDueDate
                                ? ` / Revised: ${formatDate(checkpoint.revisedDueDate)}`
                                : ""}
                            </p>

                            {checkpoint.submissions.length > 0 ? (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {checkpoint.submissions.map((submission) => (
                                  <div
                                    key={submission.id}
                                    className="rounded-2xl border border-ink/10 bg-panel/70 p-3"
                                  >
                                    <p className="text-sm font-medium text-ink">
                                      {titleCase(submission.submittedByRole)} feedback
                                    </p>
                                    <p className="mt-1 text-sm text-ink/70">
                                      Score: {submission.score}/5
                                    </p>
                                    <p className="mt-1 text-sm text-ink/70">
                                      {submission.comments || "Blank open-ended response"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {canSubmitEmployee || canSubmitManager ? (
                              <form
                                action={submitProbationFeedbackAction}
                                className="mt-3 grid gap-3"
                              >
                                <input
                                  type="hidden"
                                  name="checkpointId"
                                  value={checkpoint.id}
                                />
                                <select
                                  name="score"
                                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                                  defaultValue="3"
                                >
                                  <option value="1">1 - Critical concern</option>
                                  <option value="2">2 - Needs support</option>
                                  <option value="3">3 - On track</option>
                                  <option value="4">4 - Strong progress</option>
                                  <option value="5">5 - Excellent progress</option>
                                </select>
                                <textarea
                                  name="comments"
                                  className="min-h-24 rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                                  placeholder={
                                    canSubmitEmployee
                                      ? "Share how probation is going, blockers, and support needed."
                                      : "Capture manager observations, readiness, and risk notes."
                                  }
                                />
                                <button
                                  type="submit"
                                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-tide"
                                >
                                  {canSubmitEmployee
                                    ? "Submit employee feedback"
                                    : "Submit manager feedback"}
                                </button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
