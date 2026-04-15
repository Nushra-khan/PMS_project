import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env, hasSupabaseEnv } from "@/lib/env";

type CookieStore = ReturnType<typeof cookies>;
type SupabaseCookie = {
  name: string;
  value: string;
  options?: Parameters<CookieStore["set"]>[2];
};

export function createServerSupabaseClient() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read without needing to write cookies.
        }
      }
    }
  });
}
