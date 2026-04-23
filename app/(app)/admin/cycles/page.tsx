import {
  createReviewCycleAction,
  enrollReviewCycleParticipantsAction,
  manageReviewEnrollmentAdminAction,
  updateReviewCycleScheduleAction
} from "@/app/(app)/admin/actions";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/session";
import {
  getReviewEnrollmentProfileOptions,
  getReviewReviewerOptions,
  getReviewsPageData
} from "@/lib/db/reviews";
import { formatDate } from "@/lib/utils";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function AdminCyclesPage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const session = await requireSession(["admin"]);
  const { cycles, enrollments } = await getReviewsPageData(session);
  const [reviewerOptions, profileOptions] = await Promise.all([
    getReviewReviewerOptions(),
    getReviewEnrollmentProfileOptions()
  ]);
  const status = searchParams?.status;
  const message = searchParams?.message;

  return (
    <AppShell
      session={session}
      title="Admin cycle controls"
      description="This surface is structured for launch readiness, waiver decisions, acting reviewer assignment, and close-window follow-up."
    >
      {status && message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(status)}`}>
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          eyebrow="Setup"
          title="Create review cycle"
          description="HR can create biannual or quarterly cycles, configure the goal window, and optionally mark the new cycle active immediately."
        >
          <form action={createReviewCycleAction} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Cycle label
              <input
                name="label"
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                placeholder="Example: FY26 H1 Review"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Cycle type
                <select
                  name="cycleType"
                  defaultValue="biannual"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                >
                  <option value="biannual">Biannual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Goal window
                <input
                  name="goalWindowLabel"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                  placeholder="Example: Jan-Jun goals"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Trigger date
                <input
                  name="triggerDate"
                  type="date"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Close date
                <input
                  name="closeDate"
                  type="date"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Finalize from
                <input
                  name="finalizeFrom"
                  type="date"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                name="isActive"
                type="checkbox"
                className="h-4 w-4 rounded border-ink/20"
              />
              Make this the active review cycle
            </label>

            <button
              type="submit"
              className="w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
            >
              Create cycle
            </button>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="Enrollment"
          title="Enroll employees"
          description="Add one or more active profiles to a cycle. Admin can use each employee's assigned manager or override with an acting reviewer."
        >
          {cycles.length === 0 || profileOptions.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
              Create a review cycle and ensure active employee profiles exist before
              enrolling participants.
            </p>
          ) : (
            <form action={enrollReviewCycleParticipantsAction} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Review cycle
                <select
                  name="cycleId"
                  defaultValue={cycles.find((cycle) => cycle.isActive)?.id ?? cycles[0]?.id}
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                >
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Employees
                <select
                  name="profileIds"
                  multiple
                  size={Math.min(8, Math.max(4, profileOptions.length))}
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                >
                  {profileOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} - {profile.department}
                      {profile.managerName ? ` - manager: ${profile.managerName}` : " - no manager"}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal leading-6 text-ink/55">
                  Hold Ctrl on Windows to select multiple employees.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Acting reviewer override
                <select
                  name="managerProfileId"
                  defaultValue=""
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                >
                  <option value="">Use each employee&apos;s assigned manager</option>
                  {reviewerOptions.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
              >
                Save enrollments
              </button>
            </form>
          )}
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Launch controls"
        title="Cycle schedule"
        description="Admin can now update close windows, set the active review cycle, and keep the finalization window aligned with launch readiness."
      >
        {cycles.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            No review cycles are configured yet.
          </p>
        ) : (
          <DataTable
            headers={["Cycle", "Track", "Window", "Status", "Update"]}
            rows={cycles.map((cycle) => [
              <div key={`${cycle.id}-cycle`}>
                <p className="font-medium text-ink">{cycle.label}</p>
                <p className="text-xs text-ink/55">{cycle.goalWindowLabel}</p>
              </div>,
              cycle.cycleType,
              <div key={`${cycle.id}-window`} className="space-y-1">
                <p>Trigger: {formatDate(cycle.triggerDate)}</p>
                <p>Close: {formatDate(cycle.closeDate)}</p>
                <p>Finalize: {cycle.finalizeFrom ? formatDate(cycle.finalizeFrom) : "N/A"}</p>
              </div>,
              <StatusBadge
                key={`${cycle.id}-active`}
                value={cycle.isActive ? "active" : "not_active"}
              />,
              <form
                key={`${cycle.id}-form`}
                action={updateReviewCycleScheduleAction}
                className="grid min-w-72 gap-2"
              >
                <input type="hidden" name="cycleId" value={cycle.id} />
                <label className="grid gap-1 text-xs font-medium uppercase tracking-[0.16em] text-ink/55">
                  Close
                  <input
                    name="closeDate"
                    type="date"
                    defaultValue={cycle.closeDate}
                    className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium uppercase tracking-[0.16em] text-ink/55">
                  Finalize from
                  <input
                    name="finalizeFrom"
                    type="date"
                    defaultValue={cycle.finalizeFrom}
                    className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={cycle.isActive}
                    className="h-4 w-4 rounded border-ink/20"
                  />
                  Active cycle
                </label>
                <button
                  type="submit"
                  className="w-fit rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-tide"
                >
                  Save schedule
                </button>
              </form>
            ])}
          />
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Finalization watch"
        title="Enrollment compliance"
        description="Admin can now waive blocked reviews, reopen/finalize enrollments, and assign an acting reviewer when the original manager cannot complete the workflow."
      >
        {enrollments.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm leading-7 text-ink/70">
            Cycle enrollment compliance will appear here once people are enrolled
            into live review cycles.
          </p>
        ) : (
          <DataTable
            headers={["Employee", "Cycle", "Status", "Manager", "Admin action", "Reviewer"]}
            rows={enrollments.map((enrollment) => [
              enrollment.employeeName,
              enrollment.cycleLabel,
              <div key={`${enrollment.id}-statuses`} className="space-y-2">
                <StatusBadge value={enrollment.reviewStatus} />
                <StatusBadge value={enrollment.discussionStatus} />
              </div>,
              enrollment.managerName,
              <form
                key={`${enrollment.id}-admin-action`}
                action={manageReviewEnrollmentAdminAction}
                className="grid min-w-72 gap-2"
              >
                <input type="hidden" name="cycleId" value={enrollment.cycleId} />
                <input type="hidden" name="profileId" value={enrollment.profileId} />
                <select
                  name="intent"
                  defaultValue="finalize"
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="finalize">Finalize review</option>
                  <option value="reopen">Reopen workflow</option>
                  <option value="waive">Waive review</option>
                </select>
                <select
                  name="rating"
                  defaultValue={enrollment.finalRating ?? ""}
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="">No rating</option>
                  <option value="below_expectations">Below expectations</option>
                  <option value="meets_expectations">Meets expectations</option>
                  <option value="above_expectations">Above expectations</option>
                </select>
                <input
                  name="notes"
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Admin note"
                />
                <button
                  type="submit"
                  className="w-fit rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-tide"
                >
                  Save action
                </button>
              </form>,
              <form
                key={`${enrollment.id}-reviewer`}
                action={manageReviewEnrollmentAdminAction}
                className="grid min-w-72 gap-2"
              >
                <input type="hidden" name="cycleId" value={enrollment.cycleId} />
                <input type="hidden" name="profileId" value={enrollment.profileId} />
                <input type="hidden" name="intent" value="reassign_manager" />
                <select
                  name="managerProfileId"
                  defaultValue={enrollment.managerProfileId}
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                >
                  {reviewerOptions.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.name}
                    </option>
                  ))}
                </select>
                <input
                  name="notes"
                  className="rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Reason for acting reviewer"
                />
                <button
                  type="submit"
                  className="w-fit rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink transition hover:bg-white/75"
                >
                  Assign reviewer
                </button>
              </form>
            ])}
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
