"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PoolClient } from "pg";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { updatePersonDetails, updatePersonManager, updatePersonRoles } from "@/lib/db/people";
import { getDbClient } from "@/lib/db/pool";
import { beginUserTransaction } from "@/lib/db/user-context";
import { AppSession } from "@/lib/types";

const PEOPLE_PATH = "/admin/people";

function redirectWithMessage(status: "success" | "error", message: string): never {
  redirect(`${PEOPLE_PATH}?status=${status}&message=${encodeURIComponent(message)}`);
}

async function runPeopleAction(
  successMessage: string,
  task: (client: PoolClient, session: AppSession) => Promise<void>
) {
  const session = await requireSession(["admin"]);
  const client = await getDbClient();

  if (!client) {
    redirectWithMessage("error", "Live database is currently unreachable. Please try again in a moment.");
  }

  try {
    await beginUserTransaction(client);
    await task(client, session);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    redirectWithMessage("error", error instanceof Error ? error.message : "The change could not be saved.");
  } finally {
    client.release();
  }

  revalidatePath(PEOPLE_PATH);
  revalidatePath("/dashboard");
  redirectWithMessage("success", successMessage);
}

const profileId = z.string().uuid("Person reference is invalid.");

export async function updatePersonRolesAction(formData: FormData) {
  const parsed = z
    .object({ profileId, roles: z.array(z.enum(["employee", "manager", "admin"])) })
    .safeParse({ profileId: formData.get("profileId"), roles: formData.getAll("roles") });

  if (!parsed.success) {
    redirectWithMessage("error", parsed.error.issues[0]?.message ?? "Roles could not be saved.");
  }

  await runPeopleAction("Roles updated.", (client, session) =>
    updatePersonRoles(client, session, parsed.data)
  );
}

export async function updatePersonManagerAction(formData: FormData) {
  const parsed = z
    .object({
      profileId,
      managerProfileId: z.union([z.literal(""), z.string().uuid("Manager reference is invalid.")])
    })
    .safeParse({
      profileId: formData.get("profileId"),
      managerProfileId: formData.get("managerProfileId") ?? ""
    });

  if (!parsed.success) {
    redirectWithMessage("error", parsed.error.issues[0]?.message ?? "Manager could not be saved.");
  }

  await runPeopleAction("Manager updated.", (client, session) =>
    updatePersonManager(client, session, {
      profileId: parsed.data.profileId,
      managerProfileId: parsed.data.managerProfileId || undefined
    })
  );
}

export async function updatePersonDetailsAction(formData: FormData) {
  const parsed = z
    .object({
      profileId,
      title: z.string().trim().min(2, "Job title is required."),
      department: z.string().trim().min(2, "Department is required."),
      teamId: z.union([z.literal(""), z.string().uuid("Team reference is invalid.")]),
      reviewTrack: z.enum(["biannual", "quarterly"]),
      isActive: z.boolean()
    })
    .safeParse({
      profileId: formData.get("profileId"),
      title: formData.get("title"),
      department: formData.get("department"),
      teamId: formData.get("teamId") ?? "",
      reviewTrack: formData.get("reviewTrack"),
      isActive: formData.get("isActive") === "on"
    });

  if (!parsed.success) {
    redirectWithMessage("error", parsed.error.issues[0]?.message ?? "Details could not be saved.");
  }

  await runPeopleAction("Details updated.", (client, session) =>
    updatePersonDetails(client, session, parsed.data)
  );
}
