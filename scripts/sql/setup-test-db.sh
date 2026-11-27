#!/usr/bin/env bash
# Creates a disposable PMS database for the RLS tests on a plain Postgres.
# Usage: scripts/sql/setup-test-db.sh "postgres://postgres@localhost:5432/pms_test"
set -euo pipefail
url="$1"
root="$(cd "$(dirname "$0")/../.." && pwd)"
psql() { command psql "$url" -v ON_ERROR_STOP=1 -q "$@"; }

psql -f "$root/scripts/sql/supabase-auth-stub.sql"
for migration in "$root"/supabase/migrations/*.sql; do
  psql -f "$migration"
done
psql -f "$root/supabase/seed.sql"
# Give every seeded profile a matching auth user (auth id = profile id).
psql -c "insert into auth.users (id, email) select id, email from public.profiles on conflict do nothing;
         update public.profiles set auth_user_id = id where auth_user_id is null;"
