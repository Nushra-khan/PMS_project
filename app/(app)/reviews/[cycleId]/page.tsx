import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import {
  submitReviewAction,
  updateDiscussionStatusAction
} from "@/app/(app)/reviews/actions";
import { requireSession } from "@/lib/auth/session";
import { getCycleDetailPageData } from "@/lib/db/reviews";
import { formatDate, titleCase } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function CycleDetailPage({
  params,
  searchParams
}: {
  params: { cycleId: string };
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession();
  const detail = await getCycleDetailPageData(session, params.cycleId);

  if (!detail) {
    notFound();
  }

  const { cycle, enrollments, submissions } = detail;
  const status = searchParams?.status;
  const message = searchParams?.message;
  const actionableEnrollments = enrollments.filter(
    (enrollment) =>
      session.userId === enrollment.profileId ||
      (session.role !== "employee" &&
        (session.userId === enrollment.managerProfileId || session.role === "admin"))
  );

  return (
    <AppShell
      session={session}
      title={cycle.label}
      description="Cycle detail is organized around close dates, enrollment state, submission progress, and finalization readiness."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard
          eyebrow="Cycle frame"
          title="Key dates"
          description="These values are now sourced from the live cycle configuration."
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
          {enrollments.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
              No enrollments are attached to this cycle yet.
            </p>
          ) : (
            <DataTable
              headers={["Employee", "Review status", "Discussion", "Final rating"]}
              rows={enrollments.map((enrollment) => [
                enrollment.employeeName,
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
          )}

          <div className="mt-5">
            {submissions.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
                No review submissions have been recorded for this cycle yet.
              </p>
            ) : (
              <DataTable
                headers={["Submission type", "Profile", "Reviewer", "Status", "Timestamp"]}
                rows={submissions.map((submission) => [
                  titleCase(submission.submissionType),
                  submission.profileName,
                  submission.reviewerName,
                  <StatusBadge
                    key={`${submission.id}-submission`}
                    value={submission.status}
                  />,
                  formatDate(submission.submittedAt)
                ])}
              />
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Action lane"
        title="Submit reviews and track discussions"
        description="The cycle workflow now supports live self reviews, manager reviews, and discussion-state updates."
      >
        {actionableEnrollments.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No direct review actions are available for your current role in this cycle.
          </p>
        ) : (
          <div className="space-y-5">
            {actionableEnrollments.map((enrollment) => {
              const selfSubmission = submissions.find(
                (submission) =>
                  submission.profileId === enrollment.profileId &&
                  submission.submissionType === "self_review"
              );
              const managerSubmission = submissions.find(
                (submission) =>
                  submission.profileId === enrollment.profileId &&
                  submission.submissionType === "manager_review"
              );
              const canSubmitSelf = session.userId === enrollment.profileId;
              const canSubmitManager =
                session.role !== "employee" &&
                (session.userId === enrollment.managerProfileId || session.role === "admin");
              const canManageDiscussion = canSubmitManager;

              return (
                <article
                  key={enrollment.id}
                  className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {enrollment.employeeName}
                      </p>
                      <p className="text-sm text-ink/65">
                        Manager: {enrollment.managerName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={enrollment.reviewStatus} />
                      <StatusBadge value={enrollment.discussionStatus} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-3xl border border-ink/10 bg-panel/80 p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tide">
                        Self review
                      </p>
                      {selfSubmission ? (
                        <div className="mt-3 space-y-2 text-sm text-ink/70">
                          <p>
                            Submitted:{" "}
                            {selfSubmission.rating
                              ? titleCase(selfSubmission.rating)
                              : "No rating"}
                          </p>
                          <p>{formatDate(selfSubmission.submittedAt)}</p>
                        </div>
                      ) : canSubmitSelf ? (
                        <form action={submitReviewAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="cycleId" value={cycle.id} />
                          <input
                            type="hidden"
                            name="profileId"
                            value={enrollment.profileId}
                          />
                          <input
                            type="hidden"
                            name="submissionType"
                            value="self_review"
                          />
                          <select
                            name="rating"
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            defaultValue="meets_expectations"
                          >
                            <option value="below_expectations">Below expectations</option>
                            <option value="meets_expectations">Meets expectations</option>
                            <option value="above_expectations">Above expectations</option>
                          </select>
                          <textarea
                            name="comments"
                            className="min-h-28 rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="Summarize delivery, impact, and support needed."
                            required
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-tide"
                          >
                            Submit self review
                          </button>
                        </form>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-ink/70">
                          No self-review action is required from this workspace.
                        </p>
                      )}
                    </div>

                    <div className="rounded-3xl border border-ink/10 bg-panel/80 p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tide">
                        Manager review
                      </p>
                      {managerSubmission ? (
                        <div className="mt-3 space-y-2 text-sm text-ink/70">
                          <p>
                            Submitted:{" "}
                            {managerSubmission.rating
                              ? titleCase(managerSubmission.rating)
                              : "No rating"}
                          </p>
                          <p>{formatDate(managerSubmission.submittedAt)}</p>
                        </div>
                      ) : canSubmitManager ? (
                        <form action={submitReviewAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="cycleId" value={cycle.id} />
                          <input
                            type="hidden"
                            name="profileId"
                            value={enrollment.profileId}
                          />
                          <input
                            type="hidden"
                            name="submissionType"
                            value="manager_review"
                          />
                          <select
                            name="rating"
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            defaultValue="meets_expectations"
                          >
                            <option value="below_expectations">Below expectations</option>
                            <option value="meets_expectations">Meets expectations</option>
                            <option value="above_expectations">Above expectations</option>
                          </select>
                          <textarea
                            name="comments"
                            className="min-h-28 rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="Capture final review notes and expected next steps."
                            required
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-tide"
                          >
                            Submit manager review
                          </button>
                        </form>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-ink/70">
                          No manager-review action is required from this workspace.
                        </p>
                      )}
                    </div>

                    <div className="rounded-3xl border border-ink/10 bg-panel/80 p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tide">
                        Discussion status
                      </p>
                      <p className="mt-3 text-sm leading-7 text-ink/70">
                        Current state: {titleCase(enrollment.discussionStatus)}
                      </p>
                      {canManageDiscussion ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <form action={updateDiscussionStatusAction}>
                            <input type="hidden" name="cycleId" value={cycle.id} />
                            <input
                              type="hidden"
                              name="profileId"
                              value={enrollment.profileId}
                            />
                            <input
                              type="hidden"
                              name="discussionStatus"
                              value="scheduled"
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-white/75"
                            >
                              Mark scheduled
                            </button>
                          </form>
                          <form action={updateDiscussionStatusAction}>
                            <input type="hidden" name="cycleId" value={cycle.id} />
                            <input
                              type="hidden"
                              name="profileId"
                              value={enrollment.profileId}
                            />
                            <input
                              type="hidden"
                              name="discussionStatus"
                              value="completed"
                            />
                            <button
                              type="submit"
                              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-tide"
                            >
                              Mark completed
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
