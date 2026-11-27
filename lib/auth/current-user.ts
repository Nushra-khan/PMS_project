import * as React from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuthUserIdResolver = () => Promise<string | null>;

// React.cache exists in the React Server Components build that Next uses.
// Outside it (scripts, tests) fall back to no caching.
const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

let testResolver: AuthUserIdResolver | null = null;

/** Lets tests choose which auth user database work runs as. */
export function setAuthUserIdResolverForTests(resolver: AuthUserIdResolver | null) {
  testResolver = resolver;
}

const resolveFromSupabase = cache(async (): Promise<string | null> => {
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

/**
 * The Supabase auth user id for the current request, or null when nobody is
 * signed in or there is no request (for example a cron job). Cached per request.
 */
export async function getCurrentAuthUserId() {
  return testResolver ? testResolver() : resolveFromSupabase();
}
