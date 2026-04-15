import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { requireSession } from "@/lib/auth/session";
import { getAccessibleGoals } from "@/lib/workflows/dashboard";

export default async function NewGoalPage() {
  const session = await requireSession();
  const myGoals = getAccessibleGoals(session).filter(
    (goal) =>
      goal.ownerProfileId === session.workspaceProfileId &&
      goal.status !== "archived"
  );
  const committedWeightage = myGoals
    .filter((goal) => goal.status === "active" || goal.status === "pending_approval")
    .reduce((total, goal) => total + goal.weightage, 0);

  return (
    <AppShell
      session={session}
      title="Draft a goal proposal"
      description="This screen is shaped around the PRD rules: employees can draft and submit goals, while managers and Admin set or confirm weightage at approval time."
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          eyebrow="Draft form"
          title="Seeded goal composer"
          description="The first implementation pass focuses on the information architecture and rule visibility so the later live form wiring can reuse the same shape."
        >
          <form className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Goal title
              <input
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                placeholder="Example: Automate Day 30/60/80 probation reminders"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Goal summary
              <textarea
                className="min-h-32 rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                placeholder="Describe the business outcome, dependencies, and review-cycle relevance."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Scope
                <select className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none">
                  <option>Individual</option>
                  <option>Team</option>
                  <option>Company</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Draft weightage
                <input
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
                  placeholder="0-100"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Due date
              <input
                type="date"
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none ring-0"
              />
            </label>

            <div className="rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4 text-sm leading-7 text-ink/70">
              Submission action will be wired next to a server action and audit
              event writer. The surrounding rule system is already accounted for
              in the data model: status changes, weightage enforcement,
              escalations, and approval notes.
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
            {myGoals.map((goal) => (
              <article
                key={goal.id}
                className="rounded-3xl border border-ink/10 bg-white/70 p-4"
              >
                <p className="font-medium text-ink">{goal.title}</p>
                <p className="mt-1 text-sm text-ink/65">
                  {goal.weightage}% weightage • {goal.status}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
