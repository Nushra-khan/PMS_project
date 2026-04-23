import { NextRequest, NextResponse } from "next/server";

import { runAutomationWorker } from "@/lib/db/automation";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-cron-secret") ?? "";
}

function authorizeCronRequest(request: NextRequest) {
  if (!env.cronSecret) {
    return {
      ok: false,
      status: 503,
      message: "CRON_SECRET is not configured."
    };
  }

  if (getBearerToken(request) !== env.cronSecret) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized cron request."
    };
  }

  return {
    ok: true,
    status: 200,
    message: "Authorized."
  };
}

async function runCron(request: NextRequest) {
  const authorization = authorizeCronRequest(request);

  if (!authorization.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: authorization.message
      },
      { status: authorization.status }
    );
  }

  const result = await runAutomationWorker();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503
  });
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
