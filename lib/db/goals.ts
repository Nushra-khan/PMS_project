import { differenceInBusinessDays } from "date-fns";
import { PoolClient } from "pg";

import { getDirectReportIds, runWithClient, toDateOnly, toDateString, toNumber } from "@/lib/db/helpers";
import { insertAuditLog, queueNotification } from "@/lib/db/workflow-events";
import { AppSession, Goal, GoalApprovalEvent, GoalUpdate, Role } from "@/lib/types";

export type GoalRecord = Goal & {
  ownerName: string;
};

export type GoalUpdateRecord = GoalUpdate & {
  goalTitle: string;
  postedByName: string;
};

export type GoalOwnerOption = {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
};

export type GoalApprovalEventRecord = GoalApprovalEvent & {
  goalTitle: string;
  actorName: string;
};

export type GoalPageData = {
  goals: GoalRecord[];
  updates: GoalUpdateRecord[];
};

export type GoalComposerData = {
  myGoals: GoalRecord[];
  committedWeightage: number;
};

export type GoalApprovalPageData = {
  pendingApprovals: GoalRecord[];
  events: GoalApprovalEventRecord[];
};

type GoalContext = GoalRecord & {
  ownerEmail: string;
  managerProfileId?: string;
  managerName?: string;
  managerEmail?: string;
};

type ProfileContext = GoalOwnerOption & {
  managerProfileId?: string;
  managerName?: string;
  managerEmail?: string;
};

type GoalScopeInput = Goal["scope"];

function mapGoalRow(row: {
  id: string;
  title: string;
  summary: string;
  owner_profile_id: string;
  owner_name: string;
  scope: Goal["scope"];
  status: Goal["status"];
  weightage: string | number;
  completion_pct: string | number;
  cycle_id: string | null;
  parent_goal_id: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | Date | null;
  due_date: string | Date;
}) {
  return {
    id: row.id,
    title: row.title,
    ownerProfileId: row.owner_profile_id,
    ownerName: row.owner_name,
    scope: row.scope,
    status: row.status,
    weightage: toNumber(row.weightage),
    completionPct: toNumber(row.completion_pct),
    cycleId: row.cycle_id ?? "",
    parentGoalId: row.parent_goal_id ?? undefined,
    createdBy: row.created_by,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: toDateString(row.approved_at),
    dueDate: toDateOnly(row.due_date) ?? "",
    summary: row.summary
  } satisfies GoalRecord;
}

function mapGoalUpdateRow(row: {
  id: string;
  goal_id: string;
  posted_by: string;
  created_at: string | Date;
  kind: GoalUpdate["kind"];
  body: string;
  goal_title: string;
  posted_by_name: string;
}) {
  return {
    id: row.id,
    goalId: row.goal_id,
    postedBy: row.posted_by,
    postedAt: toDateString(row.created_at) ?? "",
    kind: row.kind,
    body: row.body,
    goalTitle: row.goal_title,
    postedByName: row.posted_by_name
  } satisfies GoalUpdateRecord;
}

function mapGoalApprovalEventRow(row: {
  id: string;
  goal_id: string;
  action: GoalApprovalEvent["action"];
  actor_profile_id: string;
  created_at: string | Date;
  notes: string | null;
  goal_title: string;
  actor_name: string;
}) {
  return {
    id: row.id,
    goalId: row.goal_id,
    action: row.action,
    actorProfileId: row.actor_profile_id,
    createdAt: toDateString(row.created_at) ?? "",
    notes: row.notes ?? undefined,
    goalTitle: row.goal_title,
    actorName: row.actor_name
  } satisfies GoalApprovalEventRecord;
}

async function getAccessibleGoalRows(client: PoolClient, session: AppSession) {
  if (session.role === "admin") {
    const result = await client.query<{
      id: string;
      title: string;
      summary: string;
      owner_profile_id: string;
      owner_name: string;
      scope: Goal["scope"];
      status: Goal["status"];
      weightage: string | number;
      completion_pct: string | number;
      cycle_id: string | null;
      parent_goal_id: string | null;
      created_by: string;
      approved_by: string | null;
      approved_at: string | Date | null;
      due_date: string | Date;
    }>(
      `
        select goals.*, owner.full_name as owner_name
        from public.goals goals
        join public.profiles owner on owner.id = goals.owner_profile_id
        order by goals.due_date asc, goals.created_at desc
      `
    );

    return result.rows.map(mapGoalRow);
  }

  if (session.role === "manager") {
    const accessibleOwnerIds = [session.userId, ...(await getDirectReportIds(client, session.userId))];
    const result = await client.query<{
      id: string;
      title: string;
      summary: string;
      owner_profile_id: string;
      owner_name: string;
      scope: Goal["scope"];
      status: Goal["status"];
      weightage: string | number;
      completion_pct: string | number;
      cycle_id: string | null;
      parent_goal_id: string | null;
      created_by: string;
      approved_by: string | null;
      approved_at: string | Date | null;
      due_date: string | Date;
    }>(
      `
        select goals.*, owner.full_name as owner_name
        from public.goals goals
        join public.profiles owner on owner.id = goals.owner_profile_id
        where goals.scope = 'company'
           or goals.owner_profile_id = any($1::uuid[])
        order by goals.due_date asc, goals.created_at desc
      `,
      [accessibleOwnerIds]
    );

    return result.rows.map(mapGoalRow);
  }

  const result = await client.query<{
    id: string;
    title: string;
    summary: string;
    owner_profile_id: string;
    owner_name: string;
    scope: Goal["scope"];
    status: Goal["status"];
    weightage: string | number;
    completion_pct: string | number;
    cycle_id: string | null;
    parent_goal_id: string | null;
    created_by: string;
    approved_by: string | null;
    approved_at: string | Date | null;
    due_date: string | Date;
  }>(
    `
      select goals.*, owner.full_name as owner_name
      from public.goals goals
      join public.profiles owner on owner.id = goals.owner_profile_id
      where goals.scope = 'company'
         or goals.owner_profile_id = $1
      order by goals.due_date asc, goals.created_at desc
    `,
    [session.userId]
  );

  return result.rows.map(mapGoalRow);
}

async function getGoalUpdateRows(client: PoolClient, session: AppSession) {
  if (session.role === "admin") {
    const result = await client.query<{
      id: string;
      goal_id: string;
      posted_by: string;
      created_at: string | Date;
      kind: GoalUpdate["kind"];
      body: string;
      goal_title: string;
      posted_by_name: string;
    }>(
      `
        select
          updates.id,
          updates.goal_id,
          updates.posted_by,
          updates.created_at,
          updates.kind,
          updates.body,
          goals.title as goal_title,
          actor.full_name as posted_by_name
        from public.goal_updates updates
        join public.goals goals on goals.id = updates.goal_id
        join public.profiles actor on actor.id = updates.posted_by
        order by updates.created_at desc
      `
    );

    return result.rows.map(mapGoalUpdateRow);
  }

  const ownerIds =
    session.role === "manager"
      ? [session.userId, ...(await getDirectReportIds(client, session.userId))]
      : [session.userId];
  const result = await client.query<{
    id: string;
    goal_id: string;
    posted_by: string;
    created_at: string | Date;
    kind: GoalUpdate["kind"];
    body: string;
    goal_title: string;
    posted_by_name: string;
  }>(
    `
      select
        updates.id,
        updates.goal_id,
        updates.posted_by,
        updates.created_at,
        updates.kind,
        updates.body,
        goals.title as goal_title,
        actor.full_name as posted_by_name
      from public.goal_updates updates
      join public.goals goals on goals.id = updates.goal_id
      join public.profiles actor on actor.id = updates.posted_by
      where goals.scope = 'company'
         or goals.owner_profile_id = any($1::uuid[])
      order by updates.created_at desc
    `,
    [ownerIds]
  );

  return result.rows.map(mapGoalUpdateRow);
}

async function getPendingApprovalRows(client: PoolClient, session: AppSession) {
  if (session.role === "admin") {
    const result = await client.query<{
      id: string;
      title: string;
      summary: string;
      owner_profile_id: string;
      owner_name: string;
      scope: Goal["scope"];
      status: Goal["status"];
      weightage: string | number;
      completion_pct: string | number;
      cycle_id: string | null;
      parent_goal_id: string | null;
      created_by: string;
      approved_by: string | null;
      approved_at: string | Date | null;
      due_date: string | Date;
    }>(
      `
        select goals.*, owner.full_name as owner_name
        from public.goals goals
        join public.profiles owner on owner.id = goals.owner_profile_id
        where goals.status in ('draft', 'pending_approval')
        order by goals.created_at desc
      `
    );

    return result.rows.map(mapGoalRow);
  }

  const directReportIds = await getDirectReportIds(client, session.userId);

  if (directReportIds.length === 0) {
    return [];
  }

  const result = await client.query<{
    id: string;
    title: string;
    summary: string;
    owner_profile_id: string;
    owner_name: string;
    scope: Goal["scope"];
    status: Goal["status"];
    weightage: string | number;
    completion_pct: string | number;
    cycle_id: string | null;
    parent_goal_id: string | null;
    created_by: string;
    approved_by: string | null;
    approved_at: string | Date | null;
    due_date: string | Date;
  }>(
    `
      select goals.*, owner.full_name as owner_name
      from public.goals goals
      join public.profiles owner on owner.id = goals.owner_profile_id
      where goals.status in ('draft', 'pending_approval')
        and goals.owner_profile_id = any($1::uuid[])
      order by goals.created_at desc
    `,
    [directReportIds]
  );

  return result.rows.map(mapGoalRow);
}

async function getGoalApprovalEventRows(client: PoolClient, session: AppSession) {
  if (session.role === "admin") {
    const result = await client.query<{
      id: string;
      goal_id: string;
      action: GoalApprovalEvent["action"];
      actor_profile_id: string;
      created_at: string | Date;
      notes: string | null;
      goal_title: string;
      actor_name: string;
    }>(
      `
        select
          events.id,
          events.goal_id,
          events.action,
          events.actor_profile_id,
          events.created_at,
          events.notes,
          goals.title as goal_title,
          actor.full_name as actor_name
        from public.goal_approval_events events
        join public.goals goals on goals.id = events.goal_id
        join public.profiles actor on actor.id = events.actor_profile_id
        order by events.created_at desc
      `
    );

    return result.rows.map(mapGoalApprovalEventRow);
  }

  const ownerIds =
    session.role === "manager"
      ? await getDirectReportIds(client, session.userId)
      : [session.userId];

  if (ownerIds.length === 0) {
    return [];
  }

  const result = await client.query<{
    id: string;
    goal_id: string;
    action: GoalApprovalEvent["action"];
    actor_profile_id: string;
    created_at: string | Date;
    notes: string | null;
    goal_title: string;
    actor_name: string;
  }>(
    `
      select
        events.id,
        events.goal_id,
        events.action,
        events.actor_profile_id,
        events.created_at,
        events.notes,
        goals.title as goal_title,
        actor.full_name as actor_name
      from public.goal_approval_events events
      join public.goals goals on goals.id = events.goal_id
      join public.profiles actor on actor.id = events.actor_profile_id
      where goals.owner_profile_id = any($1::uuid[])
      order by events.created_at desc
    `,
    [ownerIds]
  );

  return result.rows.map(mapGoalApprovalEventRow);
}

async function getCurrentCycleId(client: PoolClient) {
  const activeResult = await client.query<{ id: string }>(
    `
      select id
      from public.review_cycles
      where is_active = true
      order by trigger_date desc
      limit 1
    `
  );

  if (activeResult.rows[0]) {
    return activeResult.rows[0].id;
  }

  const fallbackResult = await client.query<{ id: string }>(
    `
      select id
      from public.review_cycles
      order by trigger_date desc
      limit 1
    `
  );

  return fallbackResult.rows[0]?.id ?? null;
}

async function getProfileContext(client: PoolClient, profileId: string) {
  const result = await client.query<{
    id: string;
    full_name: string;
    email: string;
    title: string;
    department: string;
    manager_profile_id: string | null;
    manager_name: string | null;
    manager_email: string | null;
  }>(
    `
      select
        profile.id,
        profile.full_name,
        profile.email,
        profile.title,
        profile.department,
        profile.manager_profile_id,
        manager.full_name as manager_name,
        manager.email as manager_email
      from public.profiles profile
      left join public.profiles manager on manager.id = profile.manager_profile_id
      where profile.id = $1
      limit 1
    `,
    [profileId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    title: row.title,
    department: row.department,
    managerProfileId: row.manager_profile_id ?? undefined,
    managerName: row.manager_name ?? undefined,
    managerEmail: row.manager_email ?? undefined
  } satisfies ProfileContext;
}

async function canAssignGoalToProfile(
  client: PoolClient,
  session: AppSession,
  targetProfileId: string
) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role !== "manager") {
    return false;
  }

  if (targetProfileId === session.userId) {
    return true;
  }

  const directReportIds = await getDirectReportIds(client, session.userId);
  return directReportIds.includes(targetProfileId);
}

async function getGoalEscalationSettings(client: PoolClient) {
  const result = await client.query<{
    goal_approval_escalation_business_days: number;
    actor_profile_id: string | null;
  }>(
    `
      select
        coalesce(settings.goal_approval_escalation_business_days, 5)
          as goal_approval_escalation_business_days,
        coalesce(
          settings.secondary_admin_profile_id,
          settings.successor_admin_profile_id,
          admin_role.profile_id
        ) as actor_profile_id
      from public.app_settings settings
      left join lateral (
        select profile_id
        from public.user_roles
        where role = 'admin'
        order by created_at asc
        limit 1
      ) admin_role on true
      where settings.singleton = true
      limit 1
    `
  );

  return {
    escalationBusinessDays:
      result.rows[0]?.goal_approval_escalation_business_days ?? 5,
    actorProfileId: result.rows[0]?.actor_profile_id ?? null
  };
}

async function syncGoalApprovalEscalations(client: PoolClient) {
  const { escalationBusinessDays, actorProfileId } =
    await getGoalEscalationSettings(client);

  const result = await client.query<{
    id: string;
    title: string;
    created_by: string;
    owner_name: string;
    owner_email: string;
    manager_email: string | null;
    pending_since: string | Date;
  }>(
    `
      select
        goals.id,
        goals.title,
        goals.created_by,
        owner.full_name as owner_name,
        owner.email as owner_email,
        manager.email as manager_email,
        coalesce(latest_event.created_at, goals.created_at) as pending_since
      from public.goals goals
      join public.profiles owner on owner.id = goals.owner_profile_id
      left join public.profiles manager on manager.id = owner.manager_profile_id
      left join lateral (
        select created_at
        from public.goal_approval_events
        where goal_id = goals.id
          and action in ('submit', 'resubmit')
        order by created_at desc
        limit 1
      ) latest_event on true
      where goals.status = 'pending_approval'
        and not exists (
          select 1
          from public.audit_logs logs
          where logs.entity_type = 'goal'
            and logs.entity_id = goals.id
            and logs.action = 'escalate_goal_approval'
            and logs.created_at >= coalesce(latest_event.created_at, goals.created_at)
        )
      order by pending_since asc
    `
  );

  const now = new Date();

  for (const row of result.rows) {
    const pendingSince = new Date(row.pending_since);
    const ageInBusinessDays = differenceInBusinessDays(now, pendingSince);

    if (ageInBusinessDays < escalationBusinessDays) {
      continue;
    }

    await insertAuditLog(client, {
      actorProfileId: actorProfileId ?? row.created_by,
      entityType: "goal",
      entityId: row.id,
      action: "escalate_goal_approval",
      summary: `Goal "${row.title}" has been pending approval for ${ageInBusinessDays} business days.`,
      metadata: {
        pendingSince: pendingSince.toISOString(),
        ageInBusinessDays,
        escalationBusinessDays
      }
    });

    await queueNotification(client, {
      audienceRole: "admin",
      title: "Goal approval escalation",
      body: `${row.owner_name}'s goal "${row.title}" has been pending approval for ${ageInBusinessDays} business days.`
    });

    if (row.manager_email) {
      await queueNotification(client, {
        audienceRole: "manager",
        title: "Goal approval escalation",
        body: `${row.owner_name}'s goal "${row.title}" needs an approval decision.`,
        recipientEmail: row.manager_email
      });
    }
  }
}

export async function runGoalApprovalEscalations() {
  return runWithClient<void>(undefined, syncGoalApprovalEscalations);
}

export async function getGoalOwnerOptions(
  session: AppSession
): Promise<GoalOwnerOption[]> {
  return runWithClient<GoalOwnerOption[]>([], async (client) => {
    if (session.role === "admin") {
      const result = await client.query<{
        id: string;
        full_name: string;
        email: string;
        title: string;
        department: string;
      }>(
        `
          select id, full_name, email, title, department
          from public.profiles
          order by full_name asc
        `
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        title: row.title,
        department: row.department
      }));
    }

    const profileIds =
      session.role === "manager"
        ? [session.userId, ...(await getDirectReportIds(client, session.userId))]
        : [session.userId];

    const result = await client.query<{
      id: string;
      full_name: string;
      email: string;
      title: string;
      department: string;
    }>(
      `
        select id, full_name, email, title, department
        from public.profiles
        where id = any($1::uuid[])
        order by full_name asc
      `,
      [profileIds]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.full_name,
      email: row.email,
      title: row.title,
      department: row.department
    }));
  });
}

export async function getGoalPageData(session: AppSession): Promise<GoalPageData> {
  return runWithClient(
    { goals: [], updates: [] },
    async (client) => {
      const [goals, updates] = await Promise.all([
        getAccessibleGoalRows(client, session),
        getGoalUpdateRows(client, session)
      ]);

      return { goals, updates };
    }
  );
}

export async function getGoalComposerData(session: AppSession): Promise<GoalComposerData> {
  return runWithClient(
    { myGoals: [], committedWeightage: 0 },
    async (client) => {
      const goals = await getAccessibleGoalRows(client, session);
      const myGoals = goals.filter(
        (goal) => goal.ownerProfileId === session.userId && goal.status !== "archived"
      );
      const committedWeightage = myGoals
        .filter((goal) => goal.status === "active" || goal.status === "pending_approval")
        .reduce((total, goal) => total + goal.weightage, 0);

      return { myGoals, committedWeightage };
    }
  );
}

export async function getGoalApprovalPageData(
  session: AppSession
): Promise<GoalApprovalPageData> {
  return runWithClient(
    { pendingApprovals: [], events: [] },
    async (client) => {
      if (session.role !== "employee") {
        await syncGoalApprovalEscalations(client);
      }

      const [pendingApprovals, events] = await Promise.all([
        getPendingApprovalRows(client, session),
        getGoalApprovalEventRows(client, session)
      ]);

      return { pendingApprovals, events };
    }
  );
}

function normalizeScope(role: Role, scope: GoalScopeInput) {
  if (role === "employee") {
    return "individual";
  }

  if (role === "manager" && scope === "company") {
    return "team";
  }

  return scope;
}

export async function createGoalRecord(
  client: PoolClient,
  session: AppSession,
  input: {
    title: string;
    summary: string;
    scope: GoalScopeInput;
    weightage: number;
    dueDate: string;
    intent: "draft" | "submit" | "activate";
  }
) {
  const cycleId = await getCurrentCycleId(client);
  const normalizedScope = normalizeScope(session.role, input.scope);
  const status =
    input.intent === "draft"
      ? "draft"
      : input.intent === "activate" && session.role !== "employee"
        ? "active"
        : "pending_approval";

  if (status === "active") {
    const activeWeightage = await getActiveWeightageTotal(
      client,
      session.userId,
      cycleId,
      "00000000-0000-0000-0000-000000000000"
    );

    if (Math.round((activeWeightage + input.weightage) * 100) / 100 !== 100) {
      throw new Error("Active goal weightage must total exactly 100%.");
    }
  }

  const goalResult = await client.query<{ id: string }>(
    `
      insert into public.goals (
        title,
        summary,
        owner_profile_id,
        scope,
        status,
        weightage,
        completion_pct,
        cycle_id,
        created_by,
        approved_by,
        approved_at,
        due_date
      )
      values ($1, $2, $3, $4, $5, $6, 0, $7, $3, $8, $9, $10)
      returning id
    `,
    [
      input.title,
      input.summary,
      session.userId,
      normalizedScope,
      status,
      input.weightage,
      cycleId,
      status === "active" ? session.userId : null,
      status === "active" ? new Date() : null,
      input.dueDate
    ]
  );

  const goalId = goalResult.rows[0]?.id;

  if (!goalId) {
    throw new Error("Goal could not be created.");
  }

  if (status === "pending_approval" || status === "active") {
    await client.query(
      `
        insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes)
        values ($1, $2, $3, $4)
      `,
      [
        goalId,
        status === "active" ? "approve" : "submit",
        session.userId,
        status === "active"
          ? "Goal created directly by manager/admin."
          : "Employee submitted goal for approval."
      ]
    );
  }

  await client.query(
    `
      insert into public.audit_logs (actor_profile_id, entity_type, entity_id, action, summary)
      values ($1, 'goal', $2, $3, $4)
    `,
    [
      session.userId,
      goalId,
      status === "draft" ? "draft" : status === "active" ? "approve" : "submit",
      status === "draft"
        ? "Goal draft created."
        : status === "active"
          ? "Manager/Admin created and activated a goal."
          : "Employee submitted a goal for approval."
    ]
  );

  return goalId;
}

async function getGoalForResolution(client: PoolClient, goalId: string) {
  const result = await client.query<{
    id: string;
    title: string;
    owner_profile_id: string;
    status: Goal["status"];
    cycle_id: string | null;
  }>(
    `
      select id, title, owner_profile_id, status, cycle_id
      from public.goals
      where id = $1
      limit 1
    `,
    [goalId]
  );

  return result.rows[0] ?? null;
}

async function getGoalContext(client: PoolClient, goalId: string) {
  const result = await client.query<{
    id: string;
    title: string;
    summary: string;
    owner_profile_id: string;
    owner_name: string;
    owner_email: string;
    manager_profile_id: string | null;
    manager_name: string | null;
    manager_email: string | null;
    scope: Goal["scope"];
    status: Goal["status"];
    weightage: string | number;
    completion_pct: string | number;
    cycle_id: string | null;
    parent_goal_id: string | null;
    created_by: string;
    approved_by: string | null;
    approved_at: string | Date | null;
    due_date: string | Date;
  }>(
    `
      select
        goals.*,
        owner.full_name as owner_name,
        owner.email as owner_email,
        owner.manager_profile_id,
        manager.full_name as manager_name,
        manager.email as manager_email
      from public.goals goals
      join public.profiles owner on owner.id = goals.owner_profile_id
      left join public.profiles manager on manager.id = owner.manager_profile_id
      where goals.id = $1
      limit 1
    `,
    [goalId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapGoalRow(row),
    ownerEmail: row.owner_email,
    managerProfileId: row.manager_profile_id ?? undefined,
    managerName: row.manager_name ?? undefined,
    managerEmail: row.manager_email ?? undefined
  } satisfies GoalContext;
}

async function canResolveGoal(client: PoolClient, session: AppSession, ownerProfileId: string) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role !== "manager") {
    return false;
  }

  const directReportIds = await getDirectReportIds(client, session.userId);
  return directReportIds.includes(ownerProfileId);
}

async function canManageGoal(client: PoolClient, session: AppSession, ownerProfileId: string) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role !== "manager") {
    return false;
  }

  if (session.userId === ownerProfileId) {
    return true;
  }

  const directReportIds = await getDirectReportIds(client, session.userId);
  return directReportIds.includes(ownerProfileId);
}

async function getActiveWeightageTotal(
  client: PoolClient,
  ownerProfileId: string,
  cycleId: string | null,
  excludedGoalId: string
) {
  const result = await client.query<{ total_weightage: string | number }>(
    `
      select coalesce(sum(weightage), 0) as total_weightage
      from public.goals
      where owner_profile_id = $1
        and cycle_id is not distinct from $2
        and status = 'active'
        and id <> $3
    `,
    [ownerProfileId, cycleId, excludedGoalId]
  );

  return toNumber(result.rows[0]?.total_weightage);
}

export async function resolveGoalApproval(
  client: PoolClient,
  session: AppSession,
  input: {
    goalId: string;
    intent: "approve" | "reject";
    weightage?: number;
    notes?: string;
  }
) {
  const goal = await getGoalContext(client, input.goalId);

  if (!goal) {
    throw new Error("Goal not found.");
  }

  const allowed = await canResolveGoal(client, session, goal.ownerProfileId);

  if (!allowed) {
    throw new Error("You do not have permission to resolve this goal.");
  }

  if (goal.status !== "pending_approval" && goal.status !== "draft") {
    throw new Error("Only draft or pending goals can be resolved.");
  }

  if (input.intent === "approve") {
    const weightage = input.weightage ?? 0;

    if (weightage <= 0) {
      throw new Error("Weightage is required for approval.");
    }

    const activeWeightage = await getActiveWeightageTotal(
      client,
      goal.ownerProfileId,
      goal.cycleId || null,
      goal.id
    );

    if (Math.round((activeWeightage + weightage) * 100) / 100 !== 100) {
      throw new Error("Approval blocked until active goal weightage totals 100%.");
    }

    await client.query(
      `
        update public.goals
        set
          status = 'active',
          weightage = $2,
          approved_by = $3,
          approved_at = timezone('utc', now())
        where id = $1
      `,
      [goal.id, weightage, session.userId]
    );

    await client.query(
      `
        insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes)
        values ($1, 'approve', $2, $3)
      `,
      [goal.id, session.userId, input.notes ?? null]
    );

    await insertAuditLog(client, {
      actorProfileId: session.userId,
      entityType: "goal",
      entityId: goal.id,
      action: "approve",
      summary: `Goal "${goal.title}" approved.`,
      metadata: {
        weightage,
        notes: input.notes ?? ""
      }
    });

    await queueNotification(client, {
      audienceRole: "employee",
      title: "Goal approved",
      body: `Your goal "${goal.title}" has been approved.`,
      recipientEmail: goal.ownerEmail
    });

    await queueNotification(client, {
      audienceRole: "admin",
      title: "Goal approved",
      body: `${goal.ownerName}'s goal "${goal.title}" has been approved.`
    });

    return "approved";
  }

  await client.query(
    `
      update public.goals
      set
        status = 'draft',
        approved_by = null,
        approved_at = null
      where id = $1
    `,
    [goal.id]
  );

  await client.query(
    `
      insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes)
      values ($1, 'reject', $2, $3)
    `,
      [goal.id, session.userId, input.notes ?? null]
    );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "goal",
    entityId: goal.id,
    action: "reject",
    summary: `Goal "${goal.title}" sent back for revision.`,
    metadata: {
      notes: input.notes ?? ""
    }
  });

  await queueNotification(client, {
    audienceRole: "employee",
    title: "Goal needs revision",
    body: `Your goal "${goal.title}" was sent back for revision.`,
    recipientEmail: goal.ownerEmail
  });

  await queueNotification(client, {
    audienceRole: "admin",
    title: "Goal returned for revision",
    body: `${goal.ownerName}'s goal "${goal.title}" was returned for revision.`
  });

  return "rejected";
}

export async function editGoal(
  client: PoolClient,
  session: AppSession,
  input: {
    goalId: string;
    title: string;
    summary: string;
    scope: GoalScopeInput;
    weightage: number;
    dueDate: string;
  }
) {
  const goal = await getGoalContext(client, input.goalId);

  if (!goal) {
    throw new Error("Goal was not found.");
  }

  if (goal.status === "archived") {
    throw new Error("Archived goals cannot be edited.");
  }

  const isOwner = session.userId === goal.ownerProfileId;
  const leadCanManage = await canManageGoal(client, session, goal.ownerProfileId);

  if (!isOwner && !leadCanManage) {
    throw new Error("You do not have permission to edit this goal.");
  }

  if (isOwner && !leadCanManage && goal.status !== "draft" && goal.status !== "pending_approval") {
    throw new Error("Goal owners can only edit draft or pending goals.");
  }

  const normalizedScope = normalizeScope(session.role, input.scope);

  if (goal.status === "active") {
    const activeWeightage = await getActiveWeightageTotal(
      client,
      goal.ownerProfileId,
      goal.cycleId || null,
      goal.id
    );

    if (Math.round((activeWeightage + input.weightage) * 100) / 100 !== 100) {
      throw new Error("Active goal edits must keep the owner's active weightage at 100%.");
    }
  }

  await client.query(
    `
      update public.goals
      set
        title = $2,
        summary = $3,
        scope = $4,
        weightage = $5,
        due_date = $6
      where id = $1
    `,
    [
      goal.id,
      input.title,
      input.summary,
      normalizedScope,
      input.weightage,
      input.dueDate
    ]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "goal",
    entityId: goal.id,
    action: "edit_goal",
    summary: `${session.profile.name} edited goal "${goal.title}".`,
    metadata: {
      priorTitle: goal.title,
      nextTitle: input.title,
      scope: normalizedScope,
      weightage: input.weightage,
      dueDate: input.dueDate
    }
  });

  if (!isOwner) {
    await queueNotification(client, {
      audienceRole: "employee",
      title: "Goal updated",
      body: `${session.profile.name} updated your goal "${goal.title}".`,
      recipientEmail: goal.ownerEmail
    });
  } else if (goal.managerEmail) {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Goal edited",
      body: `${goal.ownerName} edited goal "${input.title}".`,
      recipientEmail: goal.managerEmail
    });
  }

  if (session.role !== "admin") {
    await queueNotification(client, {
      audienceRole: "admin",
      title: "Goal edited",
      body: `${session.profile.name} edited goal "${input.title}".`
    });
  }

  return goal.id;
}

export async function reassignGoalOwner(
  client: PoolClient,
  session: AppSession,
  input: {
    goalId: string;
    ownerProfileId: string;
    notes?: string;
  }
) {
  if (session.role !== "manager" && session.role !== "admin") {
    throw new Error("Only managers or Admin can reassign goals.");
  }

  const goal = await getGoalContext(client, input.goalId);

  if (!goal) {
    throw new Error("Goal was not found.");
  }

  if (goal.status === "completed" || goal.status === "archived") {
    throw new Error("Completed or archived goals cannot be reassigned.");
  }

  if (goal.ownerProfileId === input.ownerProfileId) {
    throw new Error("Choose a different owner before reassigning this goal.");
  }

  const canManageCurrentOwner = await canManageGoal(client, session, goal.ownerProfileId);

  if (!canManageCurrentOwner) {
    throw new Error("You do not have permission to reassign this goal.");
  }

  const canAssignTarget = await canAssignGoalToProfile(
    client,
    session,
    input.ownerProfileId
  );

  if (!canAssignTarget) {
    throw new Error("You can only reassign goals to profiles in your workspace scope.");
  }

  const nextOwner = await getProfileContext(client, input.ownerProfileId);

  if (!nextOwner) {
    throw new Error("Selected owner was not found.");
  }

  const nextStatus = goal.status === "active" ? "pending_approval" : goal.status;

  await client.query(
    `
      update public.goals
      set
        owner_profile_id = $2,
        status = $3,
        approved_by = case when $3 = 'pending_approval' then null else approved_by end,
        approved_at = case when $3 = 'pending_approval' then null else approved_at end
      where id = $1
    `,
    [goal.id, nextOwner.id, nextStatus]
  );

  if (goal.status === "active") {
    await client.query(
      `
        insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes)
        values ($1, 'submit', $2, $3)
      `,
      [
        goal.id,
        session.userId,
        input.notes ??
          "Active goal reassigned and returned to approval for owner/weightage confirmation."
      ]
    );
  }

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "goal",
    entityId: goal.id,
    action: "reassign_goal",
    summary: `${session.profile.name} reassigned "${goal.title}" from ${goal.ownerName} to ${nextOwner.name}.`,
    metadata: {
      previousOwnerProfileId: goal.ownerProfileId,
      nextOwnerProfileId: nextOwner.id,
      nextStatus,
      notes: input.notes ?? ""
    }
  });

  await queueNotification(client, {
    audienceRole: "employee",
    title: "Goal reassigned",
    body: `Goal "${goal.title}" has been reassigned to you.`,
    recipientEmail: nextOwner.email
  });

  await queueNotification(client, {
    audienceRole: "employee",
    title: "Goal ownership changed",
    body: `Goal "${goal.title}" was reassigned from your workspace.`,
    recipientEmail: goal.ownerEmail
  });

  if (nextOwner.managerEmail) {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Goal reassigned to your team",
      body: `${nextOwner.name} now owns "${goal.title}".`,
      recipientEmail: nextOwner.managerEmail
    });
  }

  await queueNotification(client, {
    audienceRole: "admin",
    title: "Goal reassigned",
    body: `${session.profile.name} reassigned "${goal.title}" from ${goal.ownerName} to ${nextOwner.name}.`
  });

  return goal.id;
}

export async function postGoalUpdate(
  client: PoolClient,
  session: AppSession,
  input: {
    goalId: string;
    kind: GoalUpdate["kind"];
    body: string;
    completionPct?: number;
  }
) {
  const goal = await getGoalContext(client, input.goalId);

  if (!goal) {
    throw new Error("Goal was not found.");
  }

  if (goal.status === "draft" || goal.status === "pending_approval" || goal.status === "archived") {
    throw new Error("Updates can only be posted against live or completed goals.");
  }

  const isOwner = session.userId === goal.ownerProfileId;
  const allowed = isOwner || (await canManageGoal(client, session, goal.ownerProfileId));

  if (!allowed) {
    throw new Error("You do not have permission to update this goal.");
  }

  const nextCompletionPct =
    input.kind === "completion" ? 100 : input.completionPct ?? goal.completionPct;

  if (nextCompletionPct < goal.completionPct) {
    throw new Error("Completion progress cannot move backward.");
  }

  const nextStatus =
    input.kind === "completion" || nextCompletionPct === 100 ? "completed" : goal.status;

  const updateResult = await client.query<{ id: string }>(
    `
      insert into public.goal_updates (goal_id, posted_by, kind, body)
      values ($1, $2, $3, $4)
      returning id
    `,
    [goal.id, session.userId, input.kind, input.body]
  );

  const updateId = updateResult.rows[0]?.id;

  await client.query(
    `
      update public.goals
      set
        completion_pct = $2,
        status = $3
      where id = $1
    `,
    [goal.id, nextCompletionPct, nextStatus]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "goal_update",
    entityId: updateId,
    action: input.kind,
    summary: `${session.profile.name} posted a ${input.kind} update on "${goal.title}".`,
    metadata: {
      goalId: goal.id,
      completionPct: nextCompletionPct,
      nextStatus
    }
  });

  if (isOwner) {
    if (goal.managerEmail) {
      await queueNotification(client, {
        audienceRole: "manager",
        title: "Goal update posted",
        body: `${goal.ownerName} posted a ${input.kind} update on "${goal.title}".`,
        recipientEmail: goal.managerEmail
      });
    }
  } else {
    await queueNotification(client, {
      audienceRole: "employee",
      title: "Goal update posted",
      body: `${session.profile.name} posted a ${input.kind} update on "${goal.title}".`,
      recipientEmail: goal.ownerEmail
    });
  }

  if (input.kind === "blocker" || nextStatus === "completed") {
    await queueNotification(client, {
      audienceRole: "admin",
      title: input.kind === "blocker" ? "Goal blocker raised" : "Goal completed",
      body:
        input.kind === "blocker"
          ? `${goal.ownerName}'s goal "${goal.title}" has a blocker update.`
          : `${goal.ownerName}'s goal "${goal.title}" is now complete.`
    });
  }

  return updateId;
}

export async function resubmitGoal(
  client: PoolClient,
  session: AppSession,
  input: {
    goalId: string;
    notes?: string;
  }
) {
  const goal = await getGoalContext(client, input.goalId);

  if (!goal) {
    throw new Error("Goal was not found.");
  }

  if (session.userId !== goal.ownerProfileId) {
    throw new Error("Only the goal owner can resubmit this goal.");
  }

  if (goal.status !== "draft") {
    throw new Error("Only draft goals can be resubmitted.");
  }

  await client.query(
    `
      update public.goals
      set
        status = 'pending_approval',
        approved_by = null,
        approved_at = null
      where id = $1
    `,
    [goal.id]
  );

  await client.query(
    `
      insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes)
      values ($1, 'resubmit', $2, $3)
    `,
    [goal.id, session.userId, input.notes ?? null]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "goal",
    entityId: goal.id,
    action: "resubmit",
    summary: `${goal.ownerName} resubmitted "${goal.title}" for approval.`,
    metadata: {
      notes: input.notes ?? ""
    }
  });

  if (goal.managerEmail) {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Goal resubmitted",
      body: `${goal.ownerName} resubmitted "${goal.title}" for approval.`,
      recipientEmail: goal.managerEmail
    });
  }

  await queueNotification(client, {
    audienceRole: "admin",
    title: "Goal resubmitted",
    body: `${goal.ownerName} resubmitted "${goal.title}" for approval.`
  });

  return goal.id;
}

export async function archiveGoal(
  client: PoolClient,
  session: AppSession,
  input: {
    goalId: string;
    notes?: string;
  }
) {
  const goal = await getGoalContext(client, input.goalId);

  if (!goal) {
    throw new Error("Goal was not found.");
  }

  if (goal.status === "archived") {
    throw new Error("This goal is already archived.");
  }

  const isOwner = session.userId === goal.ownerProfileId;
  const canLeadArchive = await canManageGoal(client, session, goal.ownerProfileId);

  if (!isOwner && !canLeadArchive) {
    throw new Error("You do not have permission to archive this goal.");
  }

  if (isOwner && goal.status !== "draft" && goal.status !== "completed") {
    throw new Error("You can only archive your own draft or completed goals.");
  }

  await client.query(
    `
      update public.goals
      set status = 'archived'
      where id = $1
    `,
    [goal.id]
  );

  await client.query(
    `
      insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes)
      values ($1, 'archive', $2, $3)
    `,
    [goal.id, session.userId, input.notes ?? null]
  );

  await insertAuditLog(client, {
    actorProfileId: session.userId,
    entityType: "goal",
    entityId: goal.id,
    action: "archive",
    summary: `${session.profile.name} archived "${goal.title}".`,
    metadata: {
      notes: input.notes ?? "",
      priorStatus: goal.status
    }
  });

  if (!isOwner) {
    await queueNotification(client, {
      audienceRole: "employee",
      title: "Goal archived",
      body: `${session.profile.name} archived "${goal.title}".`,
      recipientEmail: goal.ownerEmail
    });
  } else if (goal.managerEmail) {
    await queueNotification(client, {
      audienceRole: "manager",
      title: "Goal archived",
      body: `${goal.ownerName} archived "${goal.title}".`,
      recipientEmail: goal.managerEmail
    });
  }

  if (session.role !== "admin") {
    await queueNotification(client, {
      audienceRole: "admin",
      title: "Goal archived",
      body: `${session.profile.name} archived "${goal.title}".`
    });
  }

  return goal.id;
}
