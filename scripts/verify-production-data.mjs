import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import pg from "pg";

const { Client } = pg;

const requiredTables = [
  "teams",
  "profiles",
  "user_roles",
  "manager_assignments",
  "employee_records",
  "app_settings",
  "review_cycles",
  "cycle_enrollments",
  "probation_cases",
  "probation_checkpoints"
];

function parseDotEnv(source) {
  const values = {};

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function toNumber(value) {
  return Number(value ?? 0);
}

function printMetric(label, value) {
  console.log(`${label}: ${value}`);
}

async function getCount(client, sql, params = []) {
  const result = await client.query(sql, params);
  return toNumber(result.rows[0]?.count);
}

async function main() {
  const projectRoot = process.cwd();
  const envText = await readFile(resolve(projectRoot, ".env"), "utf8");
  const env = parseDotEnv(envText);
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  const errors = [];
  const warnings = [];

  try {
    console.log("Verifying PMS production data readiness...");

    for (const table of requiredTables) {
      const result = await client.query("select to_regclass($1) as table_name", [
        `public.${table}`
      ]);

      if (!result.rows[0]?.table_name) {
        errors.push(`Missing table: public.${table}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }

    const [
      teamCount,
      profileCount,
      adminCount,
      managerCount,
      employeeCount,
      managerAssignmentCount,
      appSettingsCount,
      reviewCycleCount,
      activeCycleCount,
      enrollmentCount,
      probationCaseCount,
      checkpointCount
    ] = await Promise.all([
      getCount(client, "select count(*) as count from public.teams"),
      getCount(client, "select count(*) as count from public.profiles where is_active = true"),
      getCount(client, "select count(*) as count from public.user_roles where role = 'admin'"),
      getCount(client, "select count(*) as count from public.user_roles where role = 'manager'"),
      getCount(client, "select count(*) as count from public.user_roles where role = 'employee'"),
      getCount(
        client,
        `
          select count(*) as count
          from public.manager_assignments
          where is_primary = true
            and (effective_to is null or effective_to >= current_date)
        `
      ),
      getCount(client, "select count(*) as count from public.app_settings where singleton = true"),
      getCount(client, "select count(*) as count from public.review_cycles"),
      getCount(client, "select count(*) as count from public.review_cycles where is_active = true"),
      getCount(client, "select count(*) as count from public.cycle_enrollments"),
      getCount(client, "select count(*) as count from public.probation_cases"),
      getCount(client, "select count(*) as count from public.probation_checkpoints")
    ]);

    printMetric("Teams", teamCount);
    printMetric("Active profiles", profileCount);
    printMetric("Admin roles", adminCount);
    printMetric("Manager roles", managerCount);
    printMetric("Employee roles", employeeCount);
    printMetric("Primary manager assignments", managerAssignmentCount);
    printMetric("App settings rows", appSettingsCount);
    printMetric("Review cycles", reviewCycleCount);
    printMetric("Active review cycles", activeCycleCount);
    printMetric("Cycle enrollments", enrollmentCount);
    printMetric("Probation cases", probationCaseCount);
    printMetric("Probation checkpoints", checkpointCount);

    if (teamCount < 1) errors.push("At least one team is required.");
    if (profileCount < 3) errors.push("At least one Admin, Manager, and Employee profile is required.");
    if (adminCount < 1) errors.push("At least one Admin role is required.");
    if (managerCount < 1) errors.push("At least one Manager role is required.");
    if (employeeCount < 1) errors.push("At least one Employee role is required.");
    if (managerAssignmentCount < 1) errors.push("At least one primary manager assignment is required.");
    if (appSettingsCount !== 1) errors.push("Exactly one singleton app_settings row is required.");
    if (reviewCycleCount < 1) errors.push("At least one review cycle is required.");
    if (activeCycleCount !== 1) warnings.push("Exactly one active review cycle is recommended.");
    if (enrollmentCount < 1) errors.push("At least one cycle enrollment is required.");
    if (probationCaseCount < 1) errors.push("At least one probation case is required.");
    if (checkpointCount < 1) errors.push("At least one probation checkpoint is required.");

    const orphanRoleCount = await getCount(
      client,
      `
        select count(*) as count
        from public.user_roles roles
        left join public.profiles profile on profile.id = roles.profile_id
        where profile.id is null
      `
    );
    const enrollmentIssueCount = await getCount(
      client,
      `
        select count(*) as count
        from public.cycle_enrollments enrollments
        left join public.profiles employee on employee.id = enrollments.profile_id
        left join public.profiles manager on manager.id = enrollments.manager_profile_id
        left join public.review_cycles cycles on cycles.id = enrollments.cycle_id
        where employee.id is null
          or manager.id is null
          or cycles.id is null
          or enrollments.profile_id = enrollments.manager_profile_id
      `
    );
    const probationIssueCount = await getCount(
      client,
      `
        select count(*) as count
        from public.probation_cases cases
        left join public.profiles employee on employee.id = cases.profile_id
        left join public.profiles admin_owner on admin_owner.id = cases.admin_owner_profile_id
        where employee.id is null
          or admin_owner.id is null
      `
    );
    const activeEmployeeWithoutManagerCount = await getCount(
      client,
      `
        select count(*) as count
        from public.profiles profile
        join public.user_roles roles on roles.profile_id = profile.id and roles.role = 'employee'
        where profile.is_active = true
          and profile.manager_profile_id is null
          and not exists (
            select 1
            from public.manager_assignments assignments
            where assignments.employee_profile_id = profile.id
              and assignments.is_primary = true
              and (assignments.effective_to is null or assignments.effective_to >= current_date)
          )
      `
    );

    if (orphanRoleCount > 0) errors.push(`${orphanRoleCount} role record(s) point to missing profiles.`);
    if (enrollmentIssueCount > 0) errors.push(`${enrollmentIssueCount} cycle enrollment(s) have missing/self reviewer references.`);
    if (probationIssueCount > 0) errors.push(`${probationIssueCount} probation case(s) have missing employee/Admin references.`);
    if (activeEmployeeWithoutManagerCount > 0) {
      warnings.push(`${activeEmployeeWithoutManagerCount} active employee role profile(s) have no manager assignment.`);
    }

    if (warnings.length > 0) {
      console.log("\nWarnings:");
      warnings.forEach((warning) => console.log(`- ${warning}`));
    }

    if (errors.length > 0) {
      console.error("\nProduction data verification failed:");
      errors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
      return;
    }

    console.log("\nProduction data verification passed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
