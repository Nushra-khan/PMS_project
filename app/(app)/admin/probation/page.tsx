import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { recordProbationDecisionAction } from "@/app/(app)/probation/actions";
import { requireSession } from "@/lib/auth/session";
import { getAdminProbationPageData } from "@/lib/db/probation";
import { formatDate, titleCase } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function AdminProbationPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession(["admin"]);
  const { cases, checkpoints } = await getAdminProbationPageData(session);
  const status = searchParams?.status;
  const message = searchParams?.message;

  return (
    <AppShell
      session={session}
      title="Admin probation operations"
      description="Blocked triggers, paused clocks, revised due dates, confirmation-prep work, and live Admin decisions all sit on one surface."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Case status"
        title="Probation case oversight"
        description="Paused leave handling, missing-manager blockers, and final call prep are modeled explicitly and now read from the live probation tables."
      >
        {cases.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No probation cases exist yet.
          </p>
        ) : (
          <DataTable
            headers={[
              "Employee",
              "Manager",
              "Case status",
              "Confirmation call",
              "Latest decision",
              "Admin owner"
            ]}
            rows={cases.map((probationCase) => [
              probationCase.employeeName,
              probationCase.managerName,
              <StatusBadge
                key={`${probationCase.id}-status`}
                value={probationCase.status}
              />,
              formatDate(probationCase.confirmationCallDate),
              probationCase.latestDecision
                ? titleCase(probationCase.latestDecision.decision)
                : "Pending",
              probationCase.adminOwnerName
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Checkpoint detail"
        title="Checkpoint and cross-share status"
        description="Admin can see the exact state of each Day 30, Day 60, and Day 80 workflow before deciding whether to waive, reassign, or escalate."
      >
        {checkpoints.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Checkpoint detail will appear once live probation workflows are created.
          </p>
        ) : (
          <DataTable
            headers={[
              "Checkpoint",
              "Employee",
              "Status",
              "Due date",
              "Revised due date",
              "Submissions"
            ]}
            rows={checkpoints.map((checkpoint) => [
              checkpoint.formTitle,
              checkpoint.employeeName,
              <StatusBadge key={`${checkpoint.id}-status`} value={checkpoint.status} />,
              formatDate(checkpoint.dueDate),
              formatDate(checkpoint.revisedDueDate),
              checkpoint.submissions.length === 0
                ? "No submissions yet"
                : checkpoint.submissions
                    .map(
                      (submission) =>
                        `${titleCase(submission.submittedByRole)} ${submission.score}/5`
                    )
                    .join(" / ")
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Decision desk"
        title="Record probation outcomes"
        description="Admin decisions now write directly to the probation case workflow and update the employee probation state."
      >
        {cases.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            There are no active probation cases to resolve.
          </p>
        ) : (
          <div className="space-y-4">
            {cases.map((probationCase) => (
              <article
                key={probationCase.id}
                className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">
                      {probationCase.employeeName}
                    </p>
                    <p className="text-sm text-ink/65">
                      Current status: {titleCase(probationCase.status)}
                    </p>
                  </div>
                  {probationCase.latestDecision ? (
                    <div className="text-right text-sm text-ink/65">
                      <p>{titleCase(probationCase.latestDecision.decision)}</p>
                      <p>{formatDate(probationCase.latestDecision.decidedAt)}</p>
                    </div>
                  ) : null}
                </div>

                <form
                  action={recordProbationDecisionAction}
                  className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]"
                >
                  <input type="hidden" name="caseId" value={probationCase.id} />
                  <select
                    name="decision"
                    className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                    defaultValue="confirm"
                  >
                    <option value="confirm">Confirm employee</option>
                    <option value="extend_probation">Extend probation</option>
                    <option value="review_further">Review further</option>
                  </select>
                  <input
                    name="notes"
                    className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                    placeholder="Add decision notes for the record."
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-tide"
                  >
                    Save decision
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
