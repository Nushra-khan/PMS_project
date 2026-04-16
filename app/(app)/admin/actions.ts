"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { updateAdminSettings } from "@/lib/db/admin";
import { getDbClient, getDbPool } from "@/lib/db/pool";

function redirectWithMessage(
  path: string,
  status: "success" | "error",
  message: string
): never {
  redirect(`${path}?status=${status}&message=${encodeURIComponent(message)}`);
}

const settingsSchema = z.object({
  redFlagThreshold: z.coerce.number().min(1).max(5),
  goalApprovalEscalationBusinessDays: z.coerce.number().min(1).max(30),
  probationEscalationDays: z.coerce.number().min(1).max(30),
  secondaryAdminProfileId: z.string().optional().transform((value) => value ?? ""),
  successorAdminProfileId: z.string().optional().transform((value) => value ?? "")
});

export async function updateAdminSettingsAction(formData: FormData) {
  const session = await requireSession(["admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage(
      "/admin/settings",
      "error",
      "Database connection is not configured yet."
    );
  }

  const parsed = settingsSchema.safeParse({
    redFlagThreshold: formData.get("redFlagThreshold"),
    goalApprovalEscalationBusinessDays: formData.get(
      "goalApprovalEscalationBusinessDays"
    ),
    probationEscalationDays: formData.get("probationEscalationDays"),
    secondaryAdminProfileId: formData.get("secondaryAdminProfileId"),
    successorAdminProfileId: formData.get("successorAdminProfileId")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/admin/settings",
      "error",
      parsed.error.issues[0]?.message ?? "Settings could not be updated."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/admin/settings",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await updateAdminSettings(client, session, parsed.data);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Settings could not be updated.";
    redirectWithMessage("/admin/settings", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/flags");
  revalidatePath("/goals");
  revalidatePath("/probation");
  revalidatePath("/admin/settings");
  redirectWithMessage("/admin/settings", "success", "Settings updated successfully.");
}
