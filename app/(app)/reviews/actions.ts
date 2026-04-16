"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { getDbClient, getDbPool } from "@/lib/db/pool";
import {
  submitReviewSubmission,
  updateDiscussionStatus
} from "@/lib/db/reviews";

const ratingValues = [
  "below_expectations",
  "meets_expectations",
  "above_expectations"
] as const;

function redirectWithMessage(
  path: string,
  status: "success" | "error",
  message: string
): never {
  redirect(`${path}?status=${status}&message=${encodeURIComponent(message)}`);
}

const reviewSubmissionSchema = z.object({
  cycleId: z.string().uuid("Cycle reference is invalid."),
  profileId: z.string().uuid("Profile reference is invalid."),
  submissionType: z.enum(["self_review", "manager_review"]),
  rating: z.enum(ratingValues),
  comments: z.string().trim().min(5, "Please add a short review summary.")
});

const discussionSchema = z.object({
  cycleId: z.string().uuid("Cycle reference is invalid."),
  profileId: z.string().uuid("Profile reference is invalid."),
  discussionStatus: z.enum(["scheduled", "completed"])
});

export async function submitReviewAction(formData: FormData) {
  const session = await requireSession();
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/reviews", "error", "Database connection is not configured yet.");
  }

  const parsed = reviewSubmissionSchema.safeParse({
    cycleId: formData.get("cycleId"),
    profileId: formData.get("profileId"),
    submissionType: formData.get("submissionType"),
    rating: formData.get("rating"),
    comments: formData.get("comments")
  });

  if (!parsed.success) {
    const fallbackCycleId = String(formData.get("cycleId") ?? "");
    redirectWithMessage(
      fallbackCycleId ? `/reviews/${fallbackCycleId}` : "/reviews",
      "error",
      parsed.error.issues[0]?.message ?? "Review submission failed."
    );
  }

  const input = parsed.data;
  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      `/reviews/${input.cycleId}`,
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await submitReviewSubmission(client, session, input);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Review submission failed.";
    redirectWithMessage(`/reviews/${input.cycleId}`, "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${input.cycleId}`);
  redirectWithMessage(`/reviews/${input.cycleId}`, "success", "Review submitted successfully.");
}

export async function updateDiscussionStatusAction(formData: FormData) {
  const session = await requireSession(["manager", "admin"]);
  const db = getDbPool();

  if (!db) {
    redirectWithMessage("/reviews", "error", "Database connection is not configured yet.");
  }

  const parsed = discussionSchema.safeParse({
    cycleId: formData.get("cycleId"),
    profileId: formData.get("profileId"),
    discussionStatus: formData.get("discussionStatus")
  });

  if (!parsed.success) {
    const fallbackCycleId = String(formData.get("cycleId") ?? "");
    redirectWithMessage(
      fallbackCycleId ? `/reviews/${fallbackCycleId}` : "/reviews",
      "error",
      parsed.error.issues[0]?.message ?? "Discussion update failed."
    );
  }

  const input = parsed.data;
  const client = await getDbClient();

  if (!client) {
    redirectWithMessage(
      `/reviews/${input.cycleId}`,
      "error",
      "Live database is currently unreachable. Please try again in a moment."
    );
  }

  try {
    await client.query("begin");
    await updateDiscussionStatus(client, session, input);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Discussion update failed.";
    redirectWithMessage(`/reviews/${input.cycleId}`, "error", message);
  } finally {
    client.release();
  }

  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${input.cycleId}`);
  redirectWithMessage(
    `/reviews/${input.cycleId}`,
    "success",
    input.discussionStatus === "scheduled"
      ? "Discussion marked as scheduled."
      : "Discussion marked as completed."
  );
}
