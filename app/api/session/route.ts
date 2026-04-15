import { NextResponse } from "next/server";

import {
  SESSION_ROLE_COOKIE,
  SESSION_USER_COOKIE
} from "@/lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const role = formData.get("role");
  const userId = formData.get("userId");
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  response.cookies.set(SESSION_ROLE_COOKIE, String(role), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  response.cookies.set(SESSION_USER_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
