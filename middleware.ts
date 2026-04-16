import { NextRequest, NextResponse } from "next/server";

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

  const { response, hasSupabaseUser } = await updateSupabaseSession(request);
  const hasSession = hasSupabaseUser;
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

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
