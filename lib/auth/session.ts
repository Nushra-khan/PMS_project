import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";

import { demoProfilesByRole, profiles } from "@/lib/demo-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppSession, Profile, Role } from "@/lib/types";

export const SESSION_ROLE_COOKIE = "pms-role";
export const SESSION_USER_COOKIE = "pms-user";

function isRole(value?: string): value is Role {
  return value === "employee" || value === "manager" || value === "admin";
}

function roleLabel(role: Role) {
  if (role === "admin") {
    return "Admin (HR)";
  }

  if (role === "manager") {
    return "Manager";
  }

  return "Employee";
}

function roleFromUser(user: User): Role {
  const metadataRole =
    user.user_metadata.role ??
    user.app_metadata.role ??
    user.user_metadata.preview_role;

  if (isRole(metadataRole)) {
    return metadataRole;
  }

  return "employee";
}

function previewWorkspaceProfileId(role: Role) {
  return demoProfilesByRole[role][0]?.id ?? profiles[0]?.id ?? role;
}

function buildPreviewProfile(user: User, role: Role): Profile {
  const demoPersona = demoProfilesByRole[role][0];
  const fallbackName = user.email?.split("@")[0] ?? "User";

  return {
    id: user.id,
    name: user.user_metadata.full_name ?? demoPersona?.name ?? fallbackName,
    email: user.email ?? demoPersona?.email ?? "",
    title: roleLabel(role),
    department: demoPersona?.department ?? "Pending setup",
    teamId: demoPersona?.teamId ?? "preview-team",
    reviewTrack: demoPersona?.reviewTrack ?? "biannual",
    roles: [role],
    managerId: demoPersona?.managerId,
    dateOfJoining: new Date().toISOString().slice(0, 10)
  };
}

async function getLiveSessionFromSupabase(): Promise<AppSession | null> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const metadataRole = roleFromUser(user);

  try {
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, title, department, team_id, review_track, manager_profile_id, date_of_joining"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profileError && profileRow) {
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("profile_id", profileRow.id);

      const liveRoles = !roleError
        ? (roleRows ?? [])
            .map((row) => row.role)
            .filter((value): value is Role => isRole(value))
        : [];
      const resolvedRole =
        liveRoles.find((role) => role === metadataRole) ??
        liveRoles[0] ??
        metadataRole;

      return {
        role: resolvedRole,
        userId: profileRow.id,
        workspaceProfileId: profileRow.id,
        sessionMode: "live",
        authUserId: user.id,
        profile: {
          id: profileRow.id,
          name: profileRow.full_name,
          email: profileRow.email,
          title: profileRow.title,
          department: profileRow.department,
          teamId: profileRow.team_id ?? "unassigned",
          reviewTrack: profileRow.review_track,
          roles: liveRoles.length > 0 ? liveRoles : [resolvedRole],
          managerId: profileRow.manager_profile_id ?? undefined,
          dateOfJoining: profileRow.date_of_joining
        }
      };
    }
  } catch {
    // If the live profile tables are not reachable yet, fall back to auth preview mode.
  }

  return {
    role: metadataRole,
    userId: user.id,
    workspaceProfileId: previewWorkspaceProfileId(metadataRole),
    sessionMode: "auth_preview",
    authUserId: user.id,
    profile: buildPreviewProfile(user, metadataRole)
  };
}

function getDemoSession(): AppSession | null {
  const cookieStore = cookies();
  const role = cookieStore.get(SESSION_ROLE_COOKIE)?.value;
  const userId = cookieStore.get(SESSION_USER_COOKIE)?.value;

  if (!isRole(role) || !userId) {
    return null;
  }

  const profile = profiles.find((entry) => entry.id === userId);

  if (!profile || !profile.roles.includes(role)) {
    return null;
  }

  return {
    role,
    userId,
    workspaceProfileId: userId,
    sessionMode: "demo",
    profile
  };
}

export async function getSession(): Promise<AppSession | null> {
  return (await getLiveSessionFromSupabase()) ?? getDemoSession();
}

export async function requireSession(allowedRoles?: Role[]) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }

  return session;
}
