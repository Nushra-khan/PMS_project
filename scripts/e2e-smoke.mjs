const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const protectedRoutes = [
  "/dashboard",
  "/goals",
  "/goals/new",
  "/goals/approvals",
  "/probation",
  "/reviews",
  "/flags",
  "/admin/settings",
  "/admin/cycles",
  "/reports"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init
  });
}

async function expectRedirect(path, expectedLocation) {
  const response = await request(path);
  const location = response.headers.get("location") ?? "";

  assert(
    response.status >= 300 && response.status < 400,
    `${path} should redirect, received ${response.status}`
  );
  assert(
    location.includes(expectedLocation),
    `${path} should redirect to ${expectedLocation}, received ${location}`
  );

  return {
    path,
    status: response.status,
    location
  };
}

async function main() {
  const results = [];

  const loginResponse = await request("/login");
  const loginHtml = await loginResponse.text();

  assert(loginResponse.status === 200, `/login should return 200, received ${loginResponse.status}`);
  assert(
    loginHtml.includes("Sign in or create your account"),
    "/login should render the authentication screen"
  );
  results.push({ path: "/login", status: loginResponse.status });

  results.push(await expectRedirect("/", "/login"));

  for (const route of protectedRoutes) {
    results.push(await expectRedirect(route, "/login"));
  }

  const cronUnauthorized = await request("/api/cron/automation");
  assert(
    cronUnauthorized.status === 401 || cronUnauthorized.status === 503,
    `/api/cron/automation should reject unauthenticated calls, received ${cronUnauthorized.status}`
  );
  results.push({
    path: "/api/cron/automation",
    status: cronUnauthorized.status
  });

  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const cronAuthorized = await request("/api/cron/automation", {
      headers: {
        Authorization: `Bearer ${cronSecret}`
      }
    });

    assert(
      cronAuthorized.status === 200 || cronAuthorized.status === 503,
      `/api/cron/automation authorized call should return worker status, received ${cronAuthorized.status}`
    );
    results.push({
      path: "/api/cron/automation authorized",
      status: cronAuthorized.status
    });
  }

  console.log("E2E smoke checks passed:");
  for (const result of results) {
    console.log(`- ${result.path}: ${result.status}${result.location ? ` -> ${result.location}` : ""}`);
  }
}

main().catch((error) => {
  console.error("E2E smoke checks failed:");
  console.error(error);
  process.exit(1);
});
