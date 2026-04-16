import { PoolClient } from "pg";

import { runWithClient } from "@/lib/db/helpers";
import { insertAuditLog } from "@/lib/db/workflow-events";
import { AppSession, AppSettings } from "@/lib/types";

export type AdminProfileOption = {
  id: string;
  name: string;
  email: string;
};

export type AdminSettingsPageData = {
  settings: AppSettings;
  secondaryAdminName: string;
  successorAdminName: string;
  adminProfiles: AdminProfileOption[];
};

const fallbackSettings: AppSettings = {
  redFlagThreshold: 2,
  goalApprovalEscalationBusinessDays: 5,
  probationEscalationDays: 7,
  secondaryAdminProfileId: "",
  successorAdminProfileId: ""
};

async function getAdminProfileOptions(client: PoolClient) {
  const result = await client.query<{
    id: string;
    full_name: string;
    email: string;
  }>(
    `
      select distinct profiles.id, profiles.full_name, profiles.email
      from public.profiles
      join public.user_roles on user_roles.profile_id = profiles.id
      where user_roles.role = 'admin'
      order by profiles.full_name asc
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email
  }));
}

export async function getAdminSettingsPageData(): Promise<AdminSettingsPageData> {
  return runWithClient<AdminSettingsPageData>(
    {
      settings: fallbackSettings,
      secondaryAdminName: "Not configured",
      successorAdminName: "Not configured",
      adminProfiles: []
    },
    async (client) => {
      const [settingsResult, adminProfiles] = await Promise.all([
        client.query<{
          red_flag_threshold: number;
          goal_approval_escalation_business_days: number;
          probation_escalation_days: number;
          secondary_admin_profile_id: string | null;
          successor_admin_profile_id: string | null;
          secondary_admin_name: string | null;
          successor_admin_name: string | null;
        }>(
          `
            select
              settings.red_flag_threshold,
              settings.goal_approval_escalation_business_days,
              settings.probation_escalation_days,
              settings.secondary_admin_profile_id,
              settings.successor_admin_profile_id,
              secondary_admin.full_name as secondary_admin_name,
              successor_admin.full_name as successor_admin_name
            from public.app_settings settings
            left join public.profiles secondary_admin
              on secondary_admin.id = settings.secondary_admin_profile_id
            left join public.profiles successor_admin
              on successor_admin.id = settings.successor_admin_profile_id
            where settings.singleton = true
            limit 1
          `
        ),
        getAdminProfileOptions(client)
      ]);

      const row = settingsResult.rows[0];

      if (!row) {
        return {
          settings: fallbackSettings,
          secondaryAdminName: "Not configured",
          successorAdminName: "Not configured",
          adminProfiles
        };
      }

      return {
        settings: {
          redFlagThreshold: row.red_flag_threshold,
          goalApprovalEscalationBusinessDays:
            row.goal_approval_escalation_business_days,
          probationEscalationDays: row.probation_escalation_days,
          secondaryAdminProfileId: row.secondary_admin_profile_id ?? "",
          successorAdminProfileId: row.successor_admin_profile_id ?? ""
        },
        secondaryAdminName: row.secondary_admin_name ?? "Not configured",
        successorAdminName: row.successor_admin_name ?? "Not configured",
        adminProfiles
      };
    }
  );
}

export async function updateAdminSettings(
  client: PoolClient,
  session: AppSession,
  input: AppSettings
) {
  if (session.role !== "admin") {
    throw new Error("Only Admin can update settings.");
  }

  await client.query(
    `
      insert into public.app_settings (
        singleton,
        red_flag_threshold,
        goal_approval_escalation_business_days,
        probation_escalation_days,
        secondary_admin_profile_id,
        successor_admin_profile_id
      )
      values (true, $1, $2, $3, $4, $5)
      on conflict (singleton) do update
      set
        red_flag_threshold = excluded.red_flag_threshold,
        goal_approval_escalation_business_days = excluded.goal_approval_escalation_business_days,
        probation_escalation_days = excluded.probation_escalation_days,
        secondary_admin_profile_id = excluded.secondary_admin_profile_id,
        successor_admin_profile_id = excluded.successor_admin_profile_id
    `,
    [
      input.redFlagThreshold,
      input.goalApprovalEscalationBusinessDays,
      input.probationEscalationDays,
      input.secondaryAdminProfileId || null,
      input.successorAdminProfileId || null
    ]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "app_settings",
    action: "update",
    summary: "Admin updated PMS workflow settings.",
    metadata: {
      redFlagThreshold: input.redFlagThreshold,
      goalApprovalEscalationBusinessDays:
        input.goalApprovalEscalationBusinessDays,
      probationEscalationDays: input.probationEscalationDays,
      secondaryAdminProfileId: input.secondaryAdminProfileId,
      successorAdminProfileId: input.successorAdminProfileId
    }
  });
}
