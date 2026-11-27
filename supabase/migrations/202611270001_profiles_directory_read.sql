-- Let every signed-in user read basic profile rows (a staff directory).
--
-- Screens show names of goal owners, managers, HR owners and reviewers. Under
-- RLS the original policy only exposed your own profile and your reports, so
-- those joins dropped rows. Sensitive data stays in its own protected tables
-- (employee_records, feedback, reviews, flags, probation).
--
-- Only matters when the app runs with DB_ENFORCE_RLS=true.

create policy "profiles_directory_select"
on public.profiles
for select
to authenticated
using (true);
