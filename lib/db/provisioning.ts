import { User } from "@supabase/supabase-js";

import { getDbPool } from "@/lib/db/pool";
import { Profile, Role } from "@/lib/types";

type ProvisionedProfile = {
  profile: Profile;
  roles: Role[];
};

function roleLabel(role: Role) {
  if (role === "admin") {
    return "Admin (HR)";
  }

  if (role === "manager") {
    return "Manager";
  }

  return "Employee";
}

function fallbackName(user: User) {
  return user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "User";
}

export async function ensureProfileForUser(
  user: User,
  role: Role
): Promise<ProvisionedProfile | null> {
  const db = getDbPool();

  if (!db || !user.email) {
    return null;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const profileResult = await client.query<{
      id: string;
      full_name: string;
      email: string;
      title: string;
      department: string;
      team_id: string | null;
      review_track: Profile["reviewTrack"];
      manager_profile_id: string | null;
      date_of_joining: string;
    }>(
      `
        insert into public.profiles (
          auth_user_id,
          full_name,
          email,
          title,
          department,
          review_track,
          date_of_joining
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (auth_user_id) do update
        set email = excluded.email
        returning
          id,
          full_name,
          email,
          title,
          department,
          team_id,
          review_track,
          manager_profile_id,
          date_of_joining
      `,
      [
        user.id,
        fallbackName(user),
        user.email,
        roleLabel(role),
        "Pending setup",
        "biannual",
        new Date().toISOString().slice(0, 10)
      ]
    );

    const profileRow = profileResult.rows[0];

    await client.query(
      `
        insert into public.user_roles (profile_id, role)
        values ($1, $2)
        on conflict (profile_id, role) do nothing
      `,
      [profileRow.id, role]
    );

    const roleResult = await client.query<{ role: Role }>(
      `
        select role
        from public.user_roles
        where profile_id = $1
      `,
      [profileRow.id]
    );

    await client.query("commit");

    const roles = roleResult.rows.map((row: { role: Role }) => row.role);

    return {
      roles,
      profile: {
        id: profileRow.id,
        name: profileRow.full_name,
        email: profileRow.email,
        title: profileRow.title,
        department: profileRow.department,
        teamId: profileRow.team_id ?? "unassigned",
        reviewTrack: profileRow.review_track,
        roles: roles.length > 0 ? roles : [role],
        managerId: profileRow.manager_profile_id ?? undefined,
        dateOfJoining: profileRow.date_of_joining
      }
    };
  } catch {
    await client.query("rollback");
    return null;
  } finally {
    client.release();
  }
}
