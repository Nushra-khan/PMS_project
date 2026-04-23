"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import {
  archiveGoal,
  createGoalRecord,
  editGoal,
  postGoalUpdate,
  reassignGoalOwner,
  resolveGoalApproval,
  resubmitGoal
} from "@/lib/db/goals";
import { getDbClient, getDbPool } from "@/lib/db/pool";
import { GoalScope } from "@/lib/types";

const createGoalSchema = z.object({
  title: z.string().trim().min(3, "Goal title is required."),
  summary: z.string().trim().min(10, "Goal summary is required."),
  scope: z.enum(["company", "team", "individual"] satisfies [GoalScope, ...GoalScope[]]),
  weightage: z.coerce
    .number()
    .min(0, "Weightage cannot be negative.")
    .max(100, "Weightage cannot exceed 100."),
  dueDate: z.string().min(1, "Due date is required."),
  intent: z.enum(["draft", "submit", "activate"])
});

const resolveGoalSchema = z.object({
  goalId: z.string().uuid("Goal reference is invalid."),
  intent: z.enum(["approve", "reject"]),
  weightage: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === "") {
        return undefined;
      }

      return Number(value);
    }),
  notes: z.string().trim().optional()
});

const goalUpdateSchema = z.object({
  goalId: z.string().uuid("Goal reference is invalid."),
  kind: z.enum(["progress", "blocker", "nudge", "completion"]),
  body: z.string().trim().min(5, "Please add a short goal update."),
  completionPct: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === "") {
        return undefined;
      }

      return Number(value);
    })
});

const goalLifecycleSchema = z.object({
  goalId: z.string().uuid("Goal reference is invalid."),
  notes: z.string().trim().optional()
});

const editGoalSchema = z.object({
  goalId: z.string().uuid("Goal reference is invalid."),
  title: z.string().trim().min(3, "Goal title is required."),
  summary: z.string().trim().min(10, "Goal summary is required."),
  scope: z.enum(["company", "team", "individual"] satisfies [GoalScope, ...GoalScope[]]),
  weightage: z.coerce
    .number()
    .min(0, "Weightage cannot be negative.")
    .max(100, "Weightage cannot exceed 100."),
  dueDate: z.string().min(1, "Due date is required.")
});

const reassignGoalSchema = z.object({
  goalId: z.string().uuid("Goal reference is invalid."),
  ownerProfileId: z.string().uuid("New owner reference is invalid."),
  notes: z.string().trim().optional()
});

function redirectWithMessage(
  path: string,
  status: "success" | "error",
  message: string
): never {
  redirect(`${path}?status=${status}&message=${encodeURIComponent(message)}`);
}

export async function createGoalAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/goals/new", "error", "Database connection is not configured yet.");
  }

  const parsed = createGoalSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    scope: formData.get("scope"),
    weightage: formData.get("weightage"),
    dueDate: formData.get("dueDate"),
    intent: formData.get("intent")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals/new",
      "error",
      parsed.error.issues[0]?.message ?? "Goal could not be saved."
    );
  }

  const input = parsed.data;

  if (session.role === "employee" && input.intent === "activate") {
    redirectWithMessage("/goals/new", "error", "Employees cannot create active goals directly.");
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals/new",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await createGoalRecord(client, session, input);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Goal could not be saved.";
    redirectWithMessage("/goals/new", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/goals/approvals");
  revalidatePath("/goals/new");
  redirectWithMessage(
    "/goals/new",
    "success",
    input.intent === "draft" ? "Goal draft saved." : "Goal saved successfully."
  );
}

export async function resolveGoalApprovalAction(formData: FormData) {
  const session = await requireSession(["manager", "admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage(
      "/goals/approvals",
      "error",
      "Database connection is not configured yet."
    );
  }

  const parsed = resolveGoalSchema.safeParse({
    goalId: formData.get("goalId"),
    intent: formData.get("intent"),
    weightage: formData.get("weightage"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals/approvals",
      "error",
      parsed.error.issues[0]?.message ?? "Approval action failed."
    );
  }

  const input = {
    ...parsed.data,
    notes: parsed.data.notes || undefined
  };

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals/approvals",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    const outcome = await resolveGoalApproval(client, session, input);
    await client.query("commit");

    revalidatePath("/dashboard");
    revalidatePath("/goals");
    revalidatePath("/goals/approvals");

    redirectWithMessage(
      "/goals/approvals",
      "success",
      outcome === "approved" ? "Goal approved successfully." : "Goal sent back for revision."
    );
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Approval action failed.";
    redirectWithMessage("/goals/approvals", "error", message);
  } finally {
    client.release();
  }
}

export async function postGoalUpdateAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/goals", "error", "Database connection is not configured yet.");
  }

  const parsed = goalUpdateSchema.safeParse({
    goalId: formData.get("goalId"),
    kind: formData.get("kind"),
    body: formData.get("body"),
    completionPct: formData.get("completionPct")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals",
      "error",
      parsed.error.issues[0]?.message ?? "Goal update failed."
    );
  }

  const input = parsed.data;

  if (
    input.completionPct !== undefined &&
    (!Number.isFinite(input.completionPct) || input.completionPct < 0 || input.completionPct > 100)
  ) {
    redirectWithMessage("/goals", "error", "Completion percentage must stay between 0 and 100.");
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await postGoalUpdate(client, session, input);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Goal update failed.";
    redirectWithMessage("/goals", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/goals/new");
  redirectWithMessage("/goals", "success", "Goal update posted successfully.");
}

export async function editGoalAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/goals", "error", "Database connection is not configured yet.");
  }

  const parsed = editGoalSchema.safeParse({
    goalId: formData.get("goalId"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    scope: formData.get("scope"),
    weightage: formData.get("weightage"),
    dueDate: formData.get("dueDate")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals",
      "error",
      parsed.error.issues[0]?.message ?? "Goal edit failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await editGoal(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Goal edit failed.";
    redirectWithMessage("/goals", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/goals/approvals");
  revalidatePath("/reports");
  redirectWithMessage("/goals", "success", "Goal updated successfully.");
}

export async function reassignGoalAction(formData: FormData) {
  const session = await requireSession(["manager", "admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/goals", "error", "Database connection is not configured yet.");
  }

  const parsed = reassignGoalSchema.safeParse({
    goalId: formData.get("goalId"),
    ownerProfileId: formData.get("ownerProfileId"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals",
      "error",
      parsed.error.issues[0]?.message ?? "Goal reassignment failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await reassignGoalOwner(client, session, {
      ...parsed.data,
      notes: parsed.data.notes || undefined
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Goal reassignment failed.";
    redirectWithMessage("/goals", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/goals/approvals");
  revalidatePath("/reports");
  redirectWithMessage("/goals", "success", "Goal reassigned successfully.");
}

export async function resubmitGoalAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/goals", "error", "Database connection is not configured yet.");
  }

  const parsed = goalLifecycleSchema.safeParse({
    goalId: formData.get("goalId"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals",
      "error",
      parsed.error.issues[0]?.message ?? "Goal resubmission failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await resubmitGoal(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Goal resubmission failed.";
    redirectWithMessage("/goals", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/goals/approvals");
  revalidatePath("/goals/new");
  redirectWithMessage("/goals", "success", "Goal sent back into the approval queue.");
}

export async function archiveGoalAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/goals", "error", "Database connection is not configured yet.");
  }

  const parsed = goalLifecycleSchema.safeParse({
    goalId: formData.get("goalId"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/goals",
      "error",
      parsed.error.issues[0]?.message ?? "Goal archive failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/goals",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await archiveGoal(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Goal archive failed.";
    redirectWithMessage("/goals", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/goals/approvals");
  revalidatePath("/goals/new");
  redirectWithMessage("/goals", "success", "Goal archived successfully.");
}
