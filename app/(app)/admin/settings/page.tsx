import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { updateAdminSettingsAction } from "@/app/(app)/admin/actions";
import { requireSession } from "@/lib/auth/session";
import { getAdminSettingsPageData } from "@/lib/db/admin";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession(["admin"]);
  const {
    settings,
    secondaryAdminName,
    successorAdminName,
    adminProfiles
  } = await getAdminSettingsPageData();
  const status = searchParams?.status;
  const message = searchParams?.message;

  return (
    <AppShell
      session={session}
      title="Admin settings and readiness"
      description="This is where onboarding-critical controls live: red-flag threshold, successor routing, and the operational guardrails that must exist before review cycles launch."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          eyebrow="Core controls"
          title="Workflow guardrails"
          description="The settings reflect the implementation plan and now read from the live Admin configuration table."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Red-flag threshold
              </p>
              <p className="mt-2 text-4xl font-semibold text-ink">
                {"<="} {settings.redFlagThreshold}
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Goal approval escalation
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {settings.goalApprovalEscalationBusinessDays} business days
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Probation escalation
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {settings.probationEscalationDays} calendar days
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Secondary Admin contact
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {secondaryAdminName}
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ink/55">
                Successor Admin
              </p>
              <p className="mt-2 text-xl font-semibold text-ink">
                {successorAdminName}
              </p>
            </div>
          </div>

          <form action={updateAdminSettingsAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Red-flag threshold
              <input
                name="redFlagThreshold"
                type="number"
                min={1}
                max={5}
                defaultValue={settings.redFlagThreshold}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Goal approval escalation business days
              <input
                name="goalApprovalEscalationBusinessDays"
                type="number"
                min={1}
                max={30}
                defaultValue={settings.goalApprovalEscalationBusinessDays}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Probation escalation days
              <input
                name="probationEscalationDays"
                type="number"
                min={1}
                max={30}
                defaultValue={settings.probationEscalationDays}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Secondary Admin
              <select
                name="secondaryAdminProfileId"
                defaultValue={settings.secondaryAdminProfileId}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
              >
                <option value="">Not configured</option>
                {adminProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Successor Admin
              <select
                name="successorAdminProfileId"
                defaultValue={settings.successorAdminProfileId}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
              >
                <option value="">Not configured</option>
                {adminProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
            >
              Update settings
            </button>
          </form>
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
