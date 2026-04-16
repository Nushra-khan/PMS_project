"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { updateFlagStatus } from "@/lib/db/flags";
import { getDbClient, getDbPool } from "@/lib/db/pool";

function redirectWithMessage(
  path: string,
  status: "success" | "error",
  message: string
): never {
  redirect(`${path}?status=${status}&message=${encodeURIComponent(message)}`);
}

const flagActionSchema = z.object({
  flagId: z.string().uuid("Flag reference is invalid."),
  status: z.enum(["under_review", "escalated", "resolved"]),
  notes: z.string().optional().transform((value) => value ?? "")
});

export async function updateFlagStatusAction(formData: FormData) {
  const session = await requireSession(["manager", "admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/flags", "error", "Database connection is not configured yet.");
  }

  const parsed = flagActionSchema.safeParse({
    flagId: formData.get("flagId"),
    status: formData.get("status"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/flags",
      "error",
      parsed.error.issues[0]?.message ?? "Flag action failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/flags",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await updateFlagStatus(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Flag action failed.";
    redirectWithMessage("/flags", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/flags");
  redirectWithMessage("/flags", "success", "Flag updated successfully.");
}
