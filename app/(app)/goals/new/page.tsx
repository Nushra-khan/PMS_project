import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { createGoalAction } from "@/app/(app)/goals/actions";
import { requireSession } from "@/lib/auth/session";
import { getGoalComposerData } from "@/lib/db/goals";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function NewGoalPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession();
  const { myGoals, committedWeightage } = await getGoalComposerData(session);
  const status = searchParams?.status;
  const message = searchParams?.message;
  const isEmployee = session.role === "employee";

  return (
    <AppShell
      session={session}
      title="Draft a goal proposal"
      description="This screen is shaped around the PRD rules: employees can draft and submit goals, while managers and Admin set or confirm weightage at approval time."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          eyebrow="Draft form"
          title="Create a live goal"
          description="This form now writes to the goal workflow directly. Employees can save drafts or submit for approval, while managers and Admin can create active goals when the weightage rules are satisfied."
        >
          <form action={createGoalAction} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Goal title
              <input
                name="title"
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                placeholder="Example: Automate Day 30/60/80 probation reminders"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Goal summary
              <textarea
                name="summary"
                className="min-h-32 rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                placeholder="Describe the business outcome, dependencies, and review-cycle relevance."
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Scope
                <select
                  name="scope"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                  defaultValue={isEmployee ? "individual" : "team"}
                >
                  <option value="individual">Individual</option>
                  {!isEmployee ? <option value="team">Team</option> : null}
                  {!isEmployee ? <option value="company">Company</option> : null}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Proposed weightage
                <input
                  name="weightage"
                  type="number"
                  min={0}
                  max={100}
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                  placeholder="0-100"
                  defaultValue={0}
                  required
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Due date
              <input
                name="dueDate"
                type="date"
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                required
              />
            </label>

            <div className="rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4 text-sm leading-7 text-ink/70">
              Live rules now apply on save: employee submissions route into the
              approval queue, and manager or Admin direct activation is blocked
              unless the active goal weightage totals exactly 100%.
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                name="intent"
                value="draft"
                className="rounded-full border border-ink/15 px-5 py-3 text-sm font-medium text-ink transition hover:bg-white/75"
              >
                Save draft
              </button>
              <button
                type="submit"
                name="intent"
                value={isEmployee ? "submit" : "activate"}
                className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
              >
                {isEmployee ? "Submit for approval" : "Create active goal"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="Weightage discipline"
          title="Approval readiness"
          description="The employee-visible counter is part of the P0 rule set so goal assignment and self-rating constraints are understandable before submission."
        >
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
              Current committed weightage
            </p>
            <p className="mt-3 text-5xl font-semibold text-ink">
              {committedWeightage}%
            </p>
            <p className="mt-3 text-sm leading-7 text-ink/70">
              Remaining to reach a balanced cycle: {100 - committedWeightage}%.
              Saves should be blocked when the final active total is not 100%.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {myGoals.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-4 text-sm leading-7 text-ink/70">
                No personal goals exist yet for this cycle.
              </div>
            ) : (
              myGoals.map((goal) => (
                <article
                  key={goal.id}
                  className="rounded-3xl border border-ink/10 bg-white/70 p-4"
                >
                  <p className="font-medium text-ink">{goal.title}</p>
                  <p className="mt-1 text-sm text-ink/65">
                    {goal.weightage}% weightage / {goal.status}
                  </p>
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
