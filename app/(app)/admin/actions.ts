"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { updateAdminSettings } from "@/lib/db/admin";
import {
  createReviewCycle,
  enrollReviewCycleParticipants,
  manageReviewEnrollmentAdmin,
  updateReviewCycleSchedule
} from "@/lib/db/reviews";
import { getDbClient, getDbPool } from "@/lib/db/pool";
import { CycleType, RatingValue } from "@/lib/types";

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

const createCycleSchema = z.object({
  label: z.string().trim().min(3, "Cycle label is required."),
  cycleType: z.enum(["biannual", "quarterly"] satisfies [CycleType, ...CycleType[]]),
  goalWindowLabel: z.string().trim().min(3, "Goal window label is required."),
  triggerDate: z.string().min(1, "Trigger date is required."),
  closeDate: z.string().min(1, "Close date is required."),
  finalizeFrom: z.string().optional().transform((value) => value ?? ""),
  isActive: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value === "on")
});

const cycleScheduleSchema = z.object({
  cycleId: z.string().uuid("Cycle reference is invalid."),
  closeDate: z.string().min(1, "Close date is required."),
  finalizeFrom: z.string().optional().transform((value) => value ?? ""),
  isActive: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value === "on")
});

const enrollCycleSchema = z.object({
  cycleId: z.string().uuid("Cycle reference is invalid."),
  profileIds: z.array(z.string().uuid("Employee reference is invalid.")).min(1, "Select at least one employee."),
  managerProfileId: z.string().optional().transform((value) => value ?? "")
});

const reviewEnrollmentSchema = z.object({
  cycleId: z.string().uuid("Cycle reference is invalid."),
  profileId: z.string().uuid("Profile reference is invalid."),
  intent: z.enum(["waive", "reopen", "finalize", "reassign_manager"]),
  rating: z
    .union([
      z.enum([
        "below_expectations",
        "meets_expectations",
        "above_expectations"
      ] satisfies [RatingValue, ...RatingValue[]]),
      z.literal(""),
      z.undefined()
    ])
    .transform((value) => (value ? value : undefined)),
  notes: z.string().optional().transform((value) => value ?? ""),
  managerProfileId: z.string().optional().transform((value) => value ?? "")
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

export async function createReviewCycleAction(formData: FormData) {
  const session = await requireSession(["admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/admin/cycles", "error", "Database connection is not configured yet.");
  }

  const parsed = createCycleSchema.safeParse({
    label: formData.get("label"),
    cycleType: formData.get("cycleType"),
    goalWindowLabel: formData.get("goalWindowLabel"),
    triggerDate: formData.get("triggerDate"),
    closeDate: formData.get("closeDate"),
    finalizeFrom: formData.get("finalizeFrom"),
    isActive: formData.get("isActive")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      parsed.error.issues[0]?.message ?? "Review cycle could not be created."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await createReviewCycle(client, session, {
      ...parsed.data,
      finalizeFrom: parsed.data.finalizeFrom || undefined
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Review cycle could not be created.";
    redirectWithMessage("/admin/cycles", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/admin/cycles");
  revalidatePath("/reports");
  redirectWithMessage("/admin/cycles", "success", "Review cycle created successfully.");
}

export async function updateReviewCycleScheduleAction(formData: FormData) {
  const session = await requireSession(["admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/admin/cycles", "error", "Database connection is not configured yet.");
  }

  const parsed = cycleScheduleSchema.safeParse({
    cycleId: formData.get("cycleId"),
    closeDate: formData.get("closeDate"),
    finalizeFrom: formData.get("finalizeFrom"),
    isActive: formData.get("isActive")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      parsed.error.issues[0]?.message ?? "Cycle schedule update failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await updateReviewCycleSchedule(client, session, {
      ...parsed.data,
      finalizeFrom: parsed.data.finalizeFrom || undefined
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Cycle schedule update failed.";
    redirectWithMessage("/admin/cycles", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/admin/cycles");
  revalidatePath(`/reviews/${parsed.data.cycleId}`);
  redirectWithMessage("/admin/cycles", "success", "Cycle schedule updated successfully.");
}

export async function enrollReviewCycleParticipantsAction(formData: FormData) {
  const session = await requireSession(["admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/admin/cycles", "error", "Database connection is not configured yet.");
  }

  const profileIds = formData
    .getAll("profileIds")
    .filter((value): value is string => typeof value === "string");

  const parsed = enrollCycleSchema.safeParse({
    cycleId: formData.get("cycleId"),
    profileIds,
    managerProfileId: formData.get("managerProfileId")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      parsed.error.issues[0]?.message ?? "Enrollment failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  let enrolledCount = 0;

  try {
    await client.query("begin");
    enrolledCount = await enrollReviewCycleParticipants(client, session, {
      ...parsed.data,
      managerProfileId: parsed.data.managerProfileId || undefined
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Enrollment failed.";
    redirectWithMessage("/admin/cycles", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/admin/cycles");
  revalidatePath(`/reviews/${parsed.data.cycleId}`);
  revalidatePath("/reports");
  redirectWithMessage(
    "/admin/cycles",
    "success",
    `${enrolledCount} review enrollment(s) saved successfully.`
  );
}

export async function manageReviewEnrollmentAdminAction(formData: FormData) {
  const session = await requireSession(["admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/admin/cycles", "error", "Database connection is not configured yet.");
  }

  const parsed = reviewEnrollmentSchema.safeParse({
    cycleId: formData.get("cycleId"),
    profileId: formData.get("profileId"),
    intent: formData.get("intent"),
    rating: formData.get("rating"),
    notes: formData.get("notes"),
    managerProfileId: formData.get("managerProfileId")
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      parsed.error.issues[0]?.message ?? "Enrollment action failed."
    );
  }

  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      "/admin/cycles",
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await manageReviewEnrollmentAdmin(client, session, {
      ...parsed.data,
      notes: parsed.data.notes || undefined,
      managerProfileId: parsed.data.managerProfileId || undefined
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Enrollment action failed.";
    redirectWithMessage("/admin/cycles", "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/admin/cycles");
  revalidatePath(`/reviews/${parsed.data.cycleId}`);
  redirectWithMessage("/admin/cycles", "success", "Enrollment action saved successfully.");
}
