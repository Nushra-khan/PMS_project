# PMS Pro

PMS Pro is a performance and goal management platform built around three roles: `employee`, `manager`, and `admin` (HR). It is a Next.js 14 App Router app backed by Supabase Auth and Postgres.

Features:

- role-aware dashboards
- goal drafting, approval, updates and escalations
- probation checkpoints (Day 30/60/80) with leave-aware working-day deadlines
- review cycles
- feedback flags
- CSV report exports
- Admin settings and a background automation worker

## Current state

All screens read and write live data in Postgres through server-side queries (`lib/db/`). If the database is configured but unreachable, the app shows an error page rather than empty data.

New sign-ups always start as `employee`. Roles are granted by an Admin in the `user_roles` table (or via Supabase `app_metadata.role`); the sign-up form does not let users pick a role.

## Run the app

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your values. `.env` and `.env.local` are git-ignored; never commit real secrets.

```bash
cp .env.example .env.local
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

This worker runs probation checkpoint/reminder/escalation automation, goal approval escalations, in-app notification delivery, and queued email delivery. Set `CRON_SECRET` in `.env.local`, then call the endpoint from your scheduler, such as Vercel Cron, GitHub Actions, Windows Task Scheduler, or any uptime/cron service.

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

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

The same checks run in GitHub Actions on every pull request (`.github/workflows/ci.yml`).

## Structure

- `app/` route-based UI using the Next.js App Router
- `components/` reusable app shell and display primitives
- `lib/auth/` session and role helpers
- `lib/db/` live Postgres queries and workflow writes
- `lib/dates/` working-day utilities
- `lib/email/` Resend and SMTP delivery
- `supabase/migrations/` schema and RLS setup
- `supabase/seed.sql` pseudo data for immediate testing
- `tests/` unit tests
