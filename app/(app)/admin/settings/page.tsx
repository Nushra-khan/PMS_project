import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { requireSession } from "@/lib/auth/session";
import { appSettings, profiles } from "@/lib/demo-data";

function profileName(profileId: string) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export default async function AdminSettingsPage() {
  const session = await requireSession(["admin"]);

  return (
    <AppShell
      session={session}
      title="Admin settings and readiness"
      description="This is where onboarding-critical controls live: red-flag threshold, successor routing, and the operational guardrails that must exist before review cycles launch."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          eyebrow="Core controls"
          title="Workflow guardrails"
          description="The settings reflect the implementation plan and are ready to move into editable forms backed by Supabase."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Red-flag threshold
              </p>
              <p className="mt-2 text-4xl font-semibold text-ink">
                &lt;= {appSettings.redFlagThreshold}
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Goal approval escalation
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {appSettings.goalApprovalEscalationBusinessDays} business days
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Secondary Admin contact
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {profileName(appSettings.secondaryAdminProfileId)}
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Successor Admin
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {profileName(appSettings.successorAdminProfileId)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Control center"
          title="Admin operational surfaces"
          description="These linked areas cover cycle controls, probation resolution, and the settings checklist that must be completed before activation."
        >
          <div className="space-y-4">
            <Link
              href="/admin/cycles"
              className="block rounded-3xl border border-ink/10 bg-white/75 p-5 transition hover:-translate-y-0.5 hover:border-tide/35"
            >
              <p className="text-lg font-semibold text-ink">Cycle operations</p>
              <p className="mt-2 text-sm leading-7 text-ink/70">
                Monitor launch dates, enrollment compliance, acting-reviewer needs,
                and close-window actions.
              </p>
            </Link>
            <Link
              href="/admin/probation"
              className="block rounded-3xl border border-ink/10 bg-white/75 p-5 transition hover:-translate-y-0.5 hover:border-tide/35"
            >
              <p className="text-lg font-semibold text-ink">Probation operations</p>
              <p className="mt-2 text-sm leading-7 text-ink/70">
                Review blocked checkpoints, paused clocks, escalations, and
                confirmation-call preparation.
              </p>
            </Link>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
