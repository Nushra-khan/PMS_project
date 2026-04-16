"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { createGoalRecord, resolveGoalApproval } from "@/lib/db/goals";
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
