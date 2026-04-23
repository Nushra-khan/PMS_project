# PMS Pro

PMS Pro is a unified performance and goal management platform built around three roles: `employee`, `manager`, and `admin`. The current implementation pass establishes the P0 foundation from the project goal and implementation plan:

- role-aware dashboards
- seeded goal management flows
- probation monitoring
- review cycle visibility
- feedback flag review surfaces
- Admin settings and operational controls
- Supabase schema and seed data for the core PMS model

## Current state

The UI currently reads from seeded in-app demo data so the routes and workflow surfaces are usable immediately.

In parallel, the repository now includes a Supabase schema and SQL seed so the app can be switched to live reads incrementally without redesigning the data model.

## Run the app

1. Install dependencies:

```bash
npm install
```

2. Make sure your local `.env` contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
APP_URL=http://localhost:3000
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) and sign in or create an account on the authentication screen.

## Background automation

The app includes a protected cron endpoint for workflow automation:

```bash
GET /api/cron/automation
Authorization: Bearer $CRON_SECRET
```

This worker runs probation checkpoint/reminder/escalation automation, goal approval escalations, in-app notification delivery, and queued email delivery. Set `CRON_SECRET` in `.env`, then call the endpoint from your scheduler, such as Vercel Cron, GitHub Actions, Windows Task Scheduler, or any uptime/cron service.

Email delivery uses `RESEND_API_KEY` + `EMAIL_FROM` when configured, otherwise it falls back to the SMTP settings in `.env.example`. If no email provider is configured, email deliveries stay queued instead of failing silently.

For Vercel deployments, `vercel.json` schedules `/api/cron/automation` hourly. Add the same `CRON_SECRET` value to the Vercel project environment variables so Vercel sends `Authorization: Bearer $CRON_SECRET` when it runs the job.

## Database setup

If you want to load the schema and pseudo data into Supabase now, you can use either the Supabase CLI or `psql` against your `DATABASE_URL`.

Use the Supabase **Session pooler** connection string for `DATABASE_URL` when your machine or deployment provider does not support IPv6. Supabase direct database URLs use IPv6 by default, while the pooler supports IPv4-compatible environments.

### Option 1: `psql`

```bash
psql "$DATABASE_URL" -f supabase/migrations/202604160001_initial_pms.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

### Option 2: Supabase CLI

Use the migration file under `supabase/migrations/` and then apply `supabase/seed.sql` as your local or hosted seed.

### Safe data-only load and verification

If the schema already exists, load pseudo-production data without re-running the migration:

```bash
npm run db:seed-only
```

Verify the required PMS production data shape:

```bash
npm run db:verify-data
```

The verifier checks teams, active profiles, role coverage, manager assignments, app settings, review cycles, cycle enrollments, probation cases, and probation checkpoints.

## Structure

- `app/` route-based UI using the Next.js App Router
- `components/` reusable app shell and display primitives
- `lib/auth/` role/session helpers
- `lib/dates/` working-day utilities
- `lib/workflows/` route-facing workflow selectors
- `supabase/migrations/` schema and RLS setup
- `supabase/seed.sql` pseudo data for immediate testing

## Next implementation steps

- replace seeded UI reads with live Supabase queries
- wire server actions for goal draft, submit, approve, and reject
- attach feedback request generation and reminder scheduling
- add real Supabase Auth session handling on top of the current role demo entry flow
- connect audit logging to live writes
