import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import {
  updatePersonDetailsAction,
  updatePersonManagerAction,
  updatePersonRolesAction
} from "@/app/(app)/admin/people/actions";
import { requireSession } from "@/lib/auth/session";
import { getPeoplePageData } from "@/lib/db/people";
import { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  admin: "Admin (HR)"
};

const inputClass = "rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none";
const buttonClass =
  "rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-tide";

function bannerTone(status?: string) {
  return status === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function AdminPeoplePage({
  searchParams
}: {
  searchParams?: { status?: string; message?: string; q?: string };
}) {
  const session = await requireSession(["admin"]);
  const { people, teams } = await getPeoplePageData();
  const query = searchParams?.q?.trim().toLowerCase() ?? "";
  const visible = query
    ? people.filter((person) =>
        [person.name, person.email, person.title, person.department, person.teamName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : people;
  const managers = people.filter(
    (person) => person.isActive && person.roles.some((role) => role === "manager" || role === "admin")
  );
  const activeCount = people.filter((person) => person.isActive).length;
  const noManagerCount = people.filter(
    (person) => person.isActive && !person.managerId && !person.roles.includes("admin")
  ).length;

  return (
    <AppShell
      session={session}
      title="People"
      description="Manage who can do what: roles, reporting lines, teams and review tracks for everyone in the workspace."
    >
      {searchParams?.status && searchParams.message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${bannerTone(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Active people", value: activeCount },
          { label: "Managers and Admins", value: managers.length },
          { label: "Missing a manager", value: noManagerCount }
        ].map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-ink/10 bg-white/80 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-ink/55">{stat.label}</p>
            <p className="mt-2 text-4xl font-semibold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <SectionCard
        eyebrow="Directory"
        title="Everyone in the workspace"
        description="New sign-ups start as employees. Grant Manager or Admin here, and set each person's manager so approvals and reviews route correctly."
      >
        <form className="mb-5 flex gap-3" action="/admin/people">
          <input
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Search by name, email, title or team"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Search
          </button>
        </form>

        {visible.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink/15 bg-white/65 p-5 text-sm text-ink/70">
            No people match that search.
          </p>
        ) : (
          <div className="space-y-4">
            {visible.map((person) => (
              <article
                key={person.id}
                className="rounded-[2rem] border border-ink/10 bg-white/75 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">
                      {person.name}
                      {!person.isActive ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink/65">
                      {person.email} · {person.title} · {person.teamName ?? "No team"}
                    </p>
                    <p className="text-xs text-ink/50">
                      Manager: {person.managerName ?? "None"} · Joined {person.dateOfJoining}
                      {person.hasLogin ? "" : " · Has not signed in yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {person.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-ink/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink/60"
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <form action={updatePersonRolesAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="profileId" value={person.id} />
                    {(["manager", "admin"] as Role[]).map((role) => (
                      <label key={role} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          name="roles"
                          value={role}
                          defaultChecked={person.roles.includes(role)}
                        />
                        {ROLE_LABELS[role]}
                      </label>
                    ))}
                    <button type="submit" className={buttonClass}>
                      Save roles
                    </button>
                  </form>

                  <form action={updatePersonManagerAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="profileId" value={person.id} />
                    <select
                      name="managerProfileId"
                      defaultValue={person.managerId ?? ""}
                      className={inputClass}
                    >
                      <option value="">No manager</option>
                      {managers
                        .filter((manager) => manager.id !== person.id)
                        .map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.name}
                          </option>
                        ))}
                    </select>
                    <button type="submit" className={buttonClass}>
                      Save manager
                    </button>
                  </form>
                </div>

                <details className="mt-4 rounded-3xl border border-dashed border-ink/15 bg-white/70 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-ink">
                    Edit job details
                  </summary>
                  <form action={updatePersonDetailsAction} className="mt-4 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="profileId" value={person.id} />
                    <label className="grid gap-1 text-sm text-ink">
                      Job title
                      <input name="title" defaultValue={person.title} className={inputClass} required />
                    </label>
                    <label className="grid gap-1 text-sm text-ink">
                      Department
                      <input
                        name="department"
                        defaultValue={person.department}
                        className={inputClass}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm text-ink">
                      Team
                      <select name="teamId" defaultValue={person.teamId ?? ""} className={inputClass}>
                        <option value="">No team</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm text-ink">
                      Review track
                      <select name="reviewTrack" defaultValue={person.reviewTrack} className={inputClass}>
                        <option value="biannual">Bi-annual</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" name="isActive" defaultChecked={person.isActive} />
                      Active
                    </label>
                    <div className="flex justify-end">
                      <button type="submit" className={buttonClass}>
                        Save details
                      </button>
                    </div>
                  </form>
                </details>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
