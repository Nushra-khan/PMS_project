import { NextResponse } from "next/server";

import {
  SESSION_ROLE_COOKIE,
  SESSION_USER_COOKIE
} from "@/lib/auth/session";

export async function POST(request: Request) {
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
