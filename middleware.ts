import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_ROLE_COOKIE,
  SESSION_USER_COOKIE
} from "@/lib/auth/session";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const role = request.cookies.get(SESSION_ROLE_COOKIE)?.value;
  const userId = request.cookies.get(SESSION_USER_COOKIE)?.value;
  const demoSession = Boolean(role && userId);
  const { response, hasSupabaseUser } = await updateSupabaseSession(request);
  const hasSession = demoSession || hasSupabaseUser;
  const isProtected =
    pathname === "/dashboard" ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/probation") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/flags") ||
    pathname.startsWith("/admin");

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtected) {
    return response;
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin") && demoSession && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
