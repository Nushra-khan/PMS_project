import { NextResponse } from "next/server";

import {
  SESSION_ROLE_COOKIE,
  SESSION_USER_COOKIE
} from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url));

  response.cookies.set(SESSION_ROLE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/"
  });
  response.cookies.set(SESSION_USER_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/"
  });

  return response;
}
