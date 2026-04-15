import { ArrowRight } from "lucide-react";

import { AuthPanel } from "@/components/auth-panel";
import { demoProfilesByRole } from "@/lib/demo-data";
import { Role } from "@/lib/types";

const roleCards: Array<{
  role: Role;
  title: string;
  description: string;
}> = [
  {
    role: "employee",
    title: "Employee workspace",
    description:
      "Use the personal view for goal drafting, probation forms, self-ratings, and feedback history."
  },
  {
    role: "manager",
    title: "Manager workspace",
    description:
      "Review pending approvals, monitor team probation checkpoints, and drive review discussions."
  },
  {
    role: "admin",
    title: "Admin (HR) workspace",
    description:
      "Monitor org-wide compliance, red flags, cycle readiness, and probation decision support."
  }
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-canvas bg-dashboard-radial px-4 py-8 text-ink">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2.4rem] border border-ink/10 bg-ink px-8 py-10 text-white shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">
            Authentication and preview access
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">
            PMS is ready for role-based implementation and iterative hardening.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/74">
            You can now use real email/password authentication through Supabase.
            The demo preview cards stay available so we can keep validating the
            PMS flows while the live workspace wiring is still being finished.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <AuthPanel />

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-ink/10 bg-panel p-6 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
                Seeded preview access
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                Explore role-based demo workspaces
              </h2>
              <p className="mt-4 text-sm leading-7 text-ink/70">
                These entries are still useful while the app transitions from
                seeded data to fully live PMS data in Supabase.
              </p>
            </section>

            <section className="grid gap-6 lg:grid-cols-1">
          {roleCards.map((card) => (
            <article
              key={card.role}
              className="rounded-[2rem] border border-ink/10 bg-panel p-6 shadow-soft"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
                {card.title}
              </p>
              <p className="mt-4 text-sm leading-7 text-ink/72">{card.description}</p>

              <div className="mt-6 space-y-3">
                {demoProfilesByRole[card.role].map((profile) => (
                  <form key={profile.id} action="/api/session" method="post">
                    <input type="hidden" name="role" value={card.role} />
                    <input type="hidden" name="userId" value={profile.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-tide/40 hover:bg-mist/40"
                    >
                      <span>
                        <span className="block font-medium text-ink">{profile.name}</span>
                        <span className="block text-sm text-ink/60">{profile.title}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-tide" />
                    </button>
                  </form>
                ))}
              </div>
            </article>
          ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
