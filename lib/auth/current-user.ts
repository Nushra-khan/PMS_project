import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The Supabase auth user id for the current request, or null when nobody is
 * signed in or there is no request (for example a cron job). Cached per request.
 */
export const getCurrentAuthUserId = cache(async (): Promise<string | null> => {
  try {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return null;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  } catch {
    return null;
  }
});
