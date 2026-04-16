import { PoolClient } from "pg";

import { getDirectReportIds, runWithClient, toDateOnly, toDateString, toNumber } from "@/lib/db/helpers";
import { AppSession, Goal, GoalApprovalEvent, GoalUpdate, Role } from "@/lib/types";

export type GoalRecord = Goal & {
  ownerName: string;
};

export type GoalUpdateRecord = GoalUpdate & {
  goalTitle: string;
  postedByName: string;
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
  const goal = await getGoalForResolution(client, input.goalId);

  if (!goal) {
    throw new Error("Goal not found.");
  }

  const allowed = await canResolveGoal(client, session, goal.owner_profile_id);

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
      goal.owner_profile_id,
      goal.cycle_id,
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

    await client.query(
      `
        insert into public.audit_logs (actor_profile_id, entity_type, entity_id, action, summary)
        values ($1, 'goal', $2, 'approve', $3)
      `,
      [session.userId, goal.id, `Goal "${goal.title}" approved.`]
    );

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

  await client.query(
    `
      insert into public.audit_logs (actor_profile_id, entity_type, entity_id, action, summary)
      values ($1, 'goal', $2, 'reject', $3)
    `,
    [session.userId, goal.id, `Goal "${goal.title}" sent back for revision.`]
  );

  return "rejected";
}
