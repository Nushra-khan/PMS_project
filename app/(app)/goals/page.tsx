import Link from "next/link";

import {
  archiveGoalAction,
  editGoalAction,
  postGoalUpdateAction,
  reassignGoalAction,
  resubmitGoalAction
} from "@/app/(app)/goals/actions";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import { getGoalOwnerOptions, getGoalPageData } from "@/lib/db/goals";
import { formatDate, formatDateTime } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function GoalsPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession();
  const { goals, updates } = await getGoalPageData(session);
  const ownerOptions = await getGoalOwnerOptions(session);
  const status = searchParams?.status;
  const message = searchParams?.message;
  const canLead = session.role === "manager" || session.role === "admin";
  const updateableGoalIds = new Set(
    goals
      .filter(
        (goal) =>
          (goal.status === "active" || goal.status === "completed") &&
          (canLead || goal.ownerProfileId === session.userId)
      )
      .map((goal) => goal.id)
  );
  const resubmittableGoalIds = new Set(
    goals
      .filter((goal) => goal.status === "draft" && goal.ownerProfileId === session.userId)
      .map((goal) => goal.id)
  );
  const archivableGoalIds = new Set(
    goals
      .filter((goal) => {
        if (canLead) {
          return goal.status !== "archived";
        }

        return (
          goal.ownerProfileId === session.userId &&
          (goal.status === "draft" || goal.status === "completed")
        );
      })
      .map((goal) => goal.id)
  );
  const actionableGoals = goals.filter(
    (goal) =>
      updateableGoalIds.has(goal.id) ||
      resubmittableGoalIds.has(goal.id) ||
      archivableGoalIds.has(goal.id)
  );

  return (
    <AppShell
      session={session}
      title="Goal management system"
      description="Company, team, and individual goals share one workspace with approval status, weightage, progress, and historical audit context."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Create and govern"
        title="Goal portfolio"
        description="This portfolio now reads from live PMS goal records so hierarchy, status transitions, approval visibility, and weightage discipline are reflected in the actual workspace."
      >
        <div className="mb-5 flex flex-wrap gap-3">
          <Link
            href="/goals/new"
            className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
          >
            Draft new goal
          </Link>
          {(session.role === "manager" || session.role === "admin") && (
            <Link
              href="/goals/approvals"
              className="rounded-full border border-ink/15 px-5 py-3 text-sm font-medium text-ink transition hover:bg-white/70"
            >
              Review approval queue
            </Link>
          )}
        </div>

        {goals.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No goal records are available yet. Create the first goal to start the
            approval and progress workflow.
          </p>
        ) : (
          <DataTable
            headers={["Goal", "Scope", "Status", "Weightage", "Due date", "Progress"]}
            rows={goals.map((goal) => [
              <div key={`${goal.id}-goal`}>
                <p className="font-medium text-ink">{goal.title}</p>
                <p className="text-xs text-ink/55">{goal.ownerName} - {goal.summary}</p>
              </div>,
              goal.scope,
              <StatusBadge key={`${goal.id}-status`} value={goal.status} />,
              `${goal.weightage}%`,
              formatDate(goal.dueDate),
              `${goal.completionPct}%`
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Live actions"
        title="Progress, resubmission, and archive controls"
        description="This surface now writes directly into the goal workflow so teams can keep progress current, send revised goals back into approval, and archive stale or completed items."
      >
        {actionableGoals.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No goal actions are available in this workspace yet. Create a goal or
            wait for a live status change to unlock progress, resubmission, or archive
            controls.
          </p>
        ) : (
          <div className="space-y-4">
            {actionableGoals.map((goal) => {
              const canPostUpdate = updateableGoalIds.has(goal.id);
              const canResubmit = resubmittableGoalIds.has(goal.id);
              const canArchive = archivableGoalIds.has(goal.id);

              return (
                <article
                  key={goal.id}
                  className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">{goal.title}</p>
                      <p className="text-sm text-ink/65">
                        {goal.ownerName} - {goal.scope} - due {formatDate(goal.dueDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={goal.status} />
                      <span className="rounded-full border border-ink/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink/60">
                        {goal.completionPct}% complete
                      </span>
                    </div>
                  </div>

                  {goal.status !== "archived" &&
                  (canLead ||
                    (goal.ownerProfileId === session.userId &&
                      (goal.status === "draft" || goal.status === "pending_approval"))) ? (
                    <details className="mt-4 rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4">
                      <summary className="cursor-pointer text-sm font-medium text-ink">
                        Edit goal details
                      </summary>
                      <form action={editGoalAction} className="mt-4 grid gap-3">
                        <input type="hidden" name="goalId" value={goal.id} />
                        <div className="grid gap-3 md:grid-cols-[1fr_170px_150px]">
                          <input
                            name="title"
                            defaultValue={goal.title}
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="Goal title"
                            required
                          />
                          <select
                            name="scope"
                            defaultValue={goal.scope}
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                          >
                            {session.role === "admin" ? (
                              <option value="company">Company</option>
                            ) : null}
                            {session.role !== "employee" ? (
                              <option value="team">Team</option>
                            ) : null}
                            <option value="individual">Individual</option>
                          </select>
                          <input
                            name="weightage"
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={goal.weightage}
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="Weightage"
                          />
                        </div>
                        <textarea
                          name="summary"
                          defaultValue={goal.summary}
                          className="min-h-24 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none"
                          placeholder="Goal summary"
                          required
                        />
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.16em] text-ink/55">
                            Due date
                            <input
                              name="dueDate"
                              type="date"
                              defaultValue={goal.dueDate}
                              className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-tide"
                          >
                            Save goal changes
                          </button>
                        </div>
                      </form>
                    </details>
                  ) : null}

                  {canLead &&
                  ownerOptions.length > 1 &&
                  goal.status !== "completed" &&
                  goal.status !== "archived" ? (
                    <form
                      action={reassignGoalAction}
                      className="mt-4 grid gap-3 rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4"
                    >
                      <input type="hidden" name="goalId" value={goal.id} />
                      <div>
                        <p className="text-sm font-medium text-ink">Reassign owner</p>
                        <p className="mt-1 text-xs leading-6 text-ink/60">
                          Active goals return to approval after reassignment so owner and
                          weightage rules stay auditable.
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <select
                          name="ownerProfileId"
                          defaultValue={goal.ownerProfileId}
                          className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                        >
                          {ownerOptions.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name} - {profile.department}
                            </option>
                          ))}
                        </select>
                        <input
                          name="notes"
                          className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Reason for reassignment"
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-ink/15 px-5 py-2 text-sm font-medium text-ink transition hover:bg-white/75"
                        >
                          Reassign
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {canPostUpdate ? (
                    <form action={postGoalUpdateAction} className="mt-4 grid gap-3">
                      <input type="hidden" name="goalId" value={goal.id} />
                      <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
                        <select
                          name="kind"
                          defaultValue={goal.completionPct >= 100 ? "completion" : "progress"}
                          className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                        >
                          <option value="progress">Progress update</option>
                          <option value="blocker">Blocker</option>
                          <option value="nudge">Manager nudge</option>
                          <option value="completion">Completion note</option>
                        </select>
                        <input
                          name="completionPct"
                          type="number"
                          min={goal.completionPct}
                          max={100}
                          defaultValue={goal.completionPct}
                          className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Completion %"
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-tide"
                        >
                          Post update
                        </button>
                      </div>
                      <textarea
                        name="body"
                        className="min-h-24 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Share the latest progress, blockers, next step, or completion context."
                        required
                      />
                    </form>
                  ) : null}

                  {canResubmit || canArchive ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {canResubmit ? (
                        <form
                          action={resubmitGoalAction}
                          className="grid gap-3 rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4"
                        >
                          <input type="hidden" name="goalId" value={goal.id} />
                          <div>
                            <p className="text-sm font-medium text-ink">Resubmit for approval</p>
                            <p className="mt-1 text-xs leading-6 text-ink/60">
                              Use this after revising a draft that was sent back.
                            </p>
                          </div>
                          <input
                            name="notes"
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="What changed before resubmission?"
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-tide"
                          >
                            Resubmit goal
                          </button>
                        </form>
                      ) : (
                        <div />
                      )}

                      {canArchive ? (
                        <form
                          action={archiveGoalAction}
                          className="grid gap-3 rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4"
                        >
                          <input type="hidden" name="goalId" value={goal.id} />
                          <div>
                            <p className="text-sm font-medium text-ink">Archive goal</p>
                            <p className="mt-1 text-xs leading-6 text-ink/60">
                              Archive stale drafts or close out completed work without deleting its history.
                            </p>
                          </div>
                          <input
                            name="notes"
                            className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="Optional archive note"
                          />
                          <button
                            type="submit"
                            className="rounded-full border border-ink/15 px-5 py-2 text-sm font-medium text-ink transition hover:bg-white/75"
                          >
                            Archive goal
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Recent updates"
        title="Progress notes and blockers"
        description="Goal updates are modeled as a first-class feed so reminders, blockers, nudges, and completions remain auditable."
      >
        {updates.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Progress updates will appear here once teams begin posting blockers,
            nudges, and completion notes against live goals.
          </p>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <article
                key={update.id}
                className="rounded-3xl border border-ink/10 bg-white/75 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <StatusBadge value={update.kind} />
                    <p className="mt-2 text-sm font-medium text-ink">
                      {update.goalTitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink/65">{update.postedByName}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/55">
                      {formatDateTime(update.postedAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink/75">{update.body}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
