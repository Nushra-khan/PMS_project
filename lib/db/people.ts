import { PoolClient } from "pg";

import { runWithClient, toDateOnly } from "@/lib/db/helpers";
import { insertAuditLog } from "@/lib/db/workflow-events";
import { AppSession, Profile, Role } from "@/lib/types";

export type PersonRecord = {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  teamId?: string;
  teamName?: string;
  reviewTrack: Profile["reviewTrack"];
  dateOfJoining: string;
  isActive: boolean;
  hasLogin: boolean;
  roles: Role[];
  managerId?: string;
  managerName?: string;
};

export type TeamOption = { id: string; name: string };

export type PeoplePageData = {
  people: PersonRecord[];
  teams: TeamOption[];
};

const ROLE_ORDER: Role[] = ["employee", "manager", "admin"];

export async function getPeoplePageData(): Promise<PeoplePageData> {
  return runWithClient<PeoplePageData>({ people: [], teams: [] }, async (client) => {
    const [peopleResult, teamsResult] = await Promise.all([
      client.query<{
        id: string;
        full_name: string;
        email: string;
        title: string;
        department: string;
        team_id: string | null;
        team_name: string | null;
        review_track: Profile["reviewTrack"];
        date_of_joining: string | Date;
        is_active: boolean;
        has_login: boolean;
        roles: Role[] | null;
        manager_id: string | null;
        manager_name: string | null;
      }>(
        `
          select
            profiles.id,
            profiles.full_name,
            profiles.email,
            profiles.title,
            profiles.department,
            profiles.team_id,
            teams.name as team_name,
            profiles.review_track,
            profiles.date_of_joining,
            profiles.is_active,
            profiles.auth_user_id is not null as has_login,
            array_remove(array_agg(distinct roles.role), null) as roles,
            manager.id as manager_id,
            manager.full_name as manager_name
          from public.profiles profiles
          left join public.teams teams on teams.id = profiles.team_id
          left join public.user_roles roles on roles.profile_id = profiles.id
          left join public.profiles manager on manager.id = profiles.manager_profile_id
          group by profiles.id, teams.name, manager.id, manager.full_name
          order by profiles.is_active desc, profiles.full_name asc
        `
      ),
      client.query<{ id: string; name: string }>(
        "select id, name from public.teams order by name asc"
      )
    ]);

    return {
      people: peopleResult.rows.map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        title: row.title,
        department: row.department,
        teamId: row.team_id ?? undefined,
        teamName: row.team_name ?? undefined,
        reviewTrack: row.review_track,
        dateOfJoining: toDateOnly(row.date_of_joining) ?? "",
        isActive: row.is_active,
        hasLogin: row.has_login,
        roles: ROLE_ORDER.filter((role) => (row.roles ?? []).includes(role)),
        managerId: row.manager_id ?? undefined,
        managerName: row.manager_name ?? undefined
      })),
      teams: teamsResult.rows
    };
  });
}

function assertAdmin(session: AppSession) {
  if (session.role !== "admin") {
    throw new Error("Only Admin can manage people.");
  }
}

async function getPersonName(client: PoolClient, profileId: string) {
  const result = await client.query<{ full_name: string }>(
    "select full_name from public.profiles where id = $1",
    [profileId]
  );
  const name = result.rows[0]?.full_name;

  if (!name) {
    throw new Error("That person was not found.");
  }

  return name;
}

/**
 * Sets a person's roles. Everyone keeps the employee role, and Admins cannot
 * remove their own admin role so the workspace is never left without one.
 */
export async function updatePersonRoles(
  client: PoolClient,
  session: AppSession,
  input: { profileId: string; roles: Role[] }
) {
  assertAdmin(session);
  const name = await getPersonName(client, input.profileId);
  const roles = ROLE_ORDER.filter((role) => role === "employee" || input.roles.includes(role));

  if (input.profileId === session.userId && !roles.includes("admin")) {
    throw new Error("You cannot remove your own Admin role.");
  }

  await client.query(
    "delete from public.user_roles where profile_id = $1 and not (role = any($2::public.app_role[]))",
    [input.profileId, roles]
  );
  await client.query(
    `
      insert into public.user_roles (profile_id, role)
      select $1, unnest($2::public.app_role[])
      on conflict (profile_id, role) do nothing
    `,
    [input.profileId, roles]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "profile",
    entityId: input.profileId,
    action: "update_roles",
    summary: `${session.profile.name} set ${name}'s roles to ${roles.join(", ")}.`,
    metadata: { roles }
  });
}

/**
 * Changes a person's primary manager. The current assignment is ended
 * yesterday and a new one starts today, so history is kept.
 */
export async function updatePersonManager(
  client: PoolClient,
  session: AppSession,
  input: { profileId: string; managerProfileId?: string }
) {
  assertAdmin(session);
  const name = await getPersonName(client, input.profileId);
  const managerId = input.managerProfileId || null;

  if (managerId === input.profileId) {
    throw new Error("A person cannot be their own manager.");
  }

  if (managerId) {
    const managerResult = await client.query<{ full_name: string; can_manage: boolean }>(
      `
        select
          profiles.full_name,
          exists (
            select 1 from public.user_roles
            where profile_id = profiles.id and role in ('manager', 'admin')
          ) as can_manage
        from public.profiles profiles
        where profiles.id = $1 and profiles.is_active
      `,
      [managerId]
    );
    const manager = managerResult.rows[0];

    if (!manager) {
      throw new Error("The selected manager was not found or is inactive.");
    }

    if (!manager.can_manage) {
      throw new Error(`${manager.full_name} needs the Manager role before they can manage people.`);
    }

    // Refuse loops such as A manages B while B manages A.
    const loopResult = await client.query<{ loops: boolean }>(
      `
        with recursive chain(id, depth) as (
          select manager_profile_id, 1 from public.profiles where id = $1
          union all
          select profiles.manager_profile_id, chain.depth + 1
          from public.profiles profiles
          join chain on profiles.id = chain.id
          where chain.depth < 50
        )
        select exists (select 1 from chain where id = $2) as loops
      `,
      [managerId, input.profileId]
    );

    if (loopResult.rows[0]?.loops) {
      throw new Error("That change would create a reporting loop.");
    }
  }

  await client.query(
    `
      update public.manager_assignments
      set effective_to = current_date - 1
      where employee_profile_id = $1
        and is_primary = true
        and (effective_to is null or effective_to >= current_date)
    `,
    [input.profileId]
  );

  if (managerId) {
    await client.query(
      `
        insert into public.manager_assignments (
          employee_profile_id, manager_profile_id, effective_from, is_primary
        )
        values ($1, $2, current_date, true)
      `,
      [input.profileId, managerId]
    );
  }

  await client.query("update public.profiles set manager_profile_id = $2 where id = $1", [
    input.profileId,
    managerId
  ]);

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "profile",
    entityId: input.profileId,
    action: "update_manager",
    summary: managerId
      ? `${session.profile.name} changed ${name}'s manager.`
      : `${session.profile.name} removed ${name}'s manager.`,
    metadata: { managerProfileId: managerId }
  });
}

/** Updates job details shown across the app. */
export async function updatePersonDetails(
  client: PoolClient,
  session: AppSession,
  input: {
    profileId: string;
    title: string;
    department: string;
    teamId?: string;
    reviewTrack: Profile["reviewTrack"];
    isActive: boolean;
  }
) {
  assertAdmin(session);
  const name = await getPersonName(client, input.profileId);

  if (input.profileId === session.userId && !input.isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  await client.query(
    `
      update public.profiles
      set title = $2, department = $3, team_id = $4, review_track = $5, is_active = $6
      where id = $1
    `,
    [
      input.profileId,
      input.title,
      input.department,
      input.teamId || null,
      input.reviewTrack,
      input.isActive
    ]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "profile",
    entityId: input.profileId,
    action: "update_profile",
    summary: `${session.profile.name} updated ${name}'s details.`,
    metadata: {
      title: input.title,
      department: input.department,
      teamId: input.teamId || null,
      reviewTrack: input.reviewTrack,
      isActive: input.isActive
    }
  });
}
