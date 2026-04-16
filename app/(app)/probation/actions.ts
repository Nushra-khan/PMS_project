"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { getDbClient, getDbPool } from "@/lib/db/pool";
import {
  recordProbationDecision,
  submitProbationFeedback
} from "@/lib/db/probation";

function redirectWithMessage(
  path: string,
  status: "success" | "error",
  message: string
): never {
  redirect(`${path}?status=${status}&message=${encodeURIComponent(message)}`);
}

const probationFeedbackSchema = z.object({
  checkpointId: z.string().uuid("Checkpoint reference is invalid."),
  score: z.coerce.number().min(1, "Score must be between 1 and 5.").max(5),
  comments: z.string().optional().transform((value) => value ?? "")
});

const probationDecisionSchema = z.object({
  caseId: z.string().uuid("Case reference is invalid."),
  decision: z.enum(["confirm", "extend_probation", "review_further"]),
  notes: z.string().optional().transform((value) => value ?? "")
});

export async function submitProbationFeedbackAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/probation", "error", "Database connection is not configured yet.");
  }

  const parsed = probationFeedbackSchema.safeParse({
    checkpointId: formData.get("checkpointId"),
    score: formData.get("score"),
    comments: formData.get("comments")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/probation",
      "error",
      parsed.error.issues[0]?.message ?? "Probation feedback failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/probation",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await submitProbationFeedback(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Probation feedback failed.";
    redirectWithMessage("/probation", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/probation");
  revalidatePath("/admin/probation");
  revalidatePath("/flags");
  redirectWithMessage("/probation", "success", "Probation feedback submitted.");
}

export async function recordProbationDecisionAction(formData: FormData) {
  const session = await requireSession(["admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage(
      "/admin/probation",
      "error",
      "Database connection is not configured yet."
    );
  }

  const parsed = probationDecisionSchema.safeParse({
    caseId: formData.get("caseId"),
    decision: formData.get("decision"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/admin/probation",
      "error",
      parsed.error.issues[0]?.message ?? "Probation decision failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/admin/probation",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await recordProbationDecision(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Probation decision failed.";
    redirectWithMessage("/admin/probation", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/probation");
  revalidatePath("/admin/probation");
  redirectWithMessage("/admin/probation", "success", "Probation decision recorded.");
}
