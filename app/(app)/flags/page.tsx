import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { updateFlagStatusAction } from "@/app/(app)/flags/actions";
import { requireSession } from "@/lib/auth/session";
import { getFlagsPageData } from "@/lib/db/flags";
import { formatDateTime } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function FlagsPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession(["manager", "admin"]);
  const { flags, submissions } = await getFlagsPageData(session);
  const status = searchParams?.status;
  const message = searchParams?.message;

  return (
    <AppShell
      session={session}
      title="Feedback and flag review"
      description="Flags are unified across probation and cycle-review submissions so repeat patterns, soft signals, and aged items are visible on one queue."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Review queue"
        title="Open and escalated flags"
        description="This queue now supports live status updates so managers and Admin can move flags into review, escalate them, or resolve them."
      >
        {flags.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No open or historical flags are visible in this workspace yet.
          </p>
        ) : (
          <div className="space-y-4">
            {flags.map((flag) => (
              <article
                key={flag.id}
                className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">{flag.employeeName}</p>
                    <p className="text-sm text-ink/65">{flag.requestLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={flag.severity} />
                    <StatusBadge value={flag.status} />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink/75">{flag.reason}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/55">
                  Aged at {formatDateTime(flag.agedAt)}
                </p>

                <form
                  action={updateFlagStatusAction}
                  className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]"
                >
                  <input type="hidden" name="flagId" value={flag.id} />
                  <select
                    name="status"
                    defaultValue={flag.status}
                    className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                  >
                    <option value="under_review">Under review</option>
                    <option value="escalated">Escalated</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <input
                    name="notes"
                    className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                    placeholder="Add review notes or escalation context."
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-tide"
                  >
                    Save flag action
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Linked submissions"
        title="Feedback context"
        description="Every flag points back to a single submission record so Admin review stays grounded in the original context."
      >
        {submissions.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Feedback submission context will appear here once probation or cycle
            review responses are stored.
          </p>
        ) : (
          <DataTable
            headers={["Submission", "Workflow", "Target", "Score", "Comments"]}
            rows={submissions.map((submission) => [
              submission.requestLabel,
              submission.workflowType,
              submission.targetName,
              `${submission.score}/5`,
              submission.comments || "Blank open-ended response"
            ])}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
