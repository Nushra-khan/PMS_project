-- Write policies for the actions people take in the app.
--
-- The original migration only defined read policies (plus goals and
-- app_settings), so with DB_ENFORCE_RLS=true every other write would be
-- refused. Each policy below mirrors the permission check the app already
-- does in lib/db, so the database enforces it too.
--
-- Not covered on purpose: profiles, user_roles, manager_assignments and
-- leave_periods (no user may change these, which stops self-promotion), and
-- notifications, notification_deliveries, feedback_requests and auto-raised
-- flags (written by the app as system records).

-- Audit entries: you can only log actions as yourself.
create policy "audit_logs_insert_self"
on public.audit_logs
for insert
to authenticated
with check (actor_profile_id = public.current_profile_id());

-- Goal updates: owner, their manager, or Admin, posting as themselves.
create policy "goal_updates_insert_access"
on public.goal_updates
for insert
to authenticated
with check (
  posted_by = public.current_profile_id()
  and exists (
    select 1
    from public.goals
    where goals.id = goal_updates.goal_id
      and (
        public.has_role('admin')
        or goals.owner_profile_id = public.current_profile_id()
        or public.is_manager_of(goals.owner_profile_id)
      )
  )
);

-- Goal approval history: anyone who can change the goal, as themselves.
create policy "goal_approval_events_insert_access"
on public.goal_approval_events
for insert
to authenticated
with check (
  actor_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.goals
    where goals.id = goal_approval_events.goal_id
      and (
        public.has_role('admin')
        or goals.owner_profile_id = public.current_profile_id()
        or public.is_manager_of(goals.owner_profile_id)
      )
  )
);

-- Flags: Admin or the flagged employee's manager can work a flag.
create policy "flags_update_access"
on public.flags
for update
to authenticated
using (
  public.has_role('admin')
  or public.is_manager_of(employee_profile_id)
)
with check (
  public.has_role('admin')
  or public.is_manager_of(employee_profile_id)
);

create policy "flag_actions_insert_access"
on public.flag_actions
for insert
to authenticated
with check (
  actor_profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.flags
    where flags.id = flag_actions.flag_id
      and (
        public.has_role('admin')
        or public.is_manager_of(flags.employee_profile_id)
      )
  )
);

-- Feedback: you submit as yourself, about yourself or someone you manage.
create policy "feedback_submissions_insert_access"
on public.feedback_submissions
for insert
to authenticated
with check (
  submitted_by = public.current_profile_id()
  and (
    public.has_role('admin')
    or target_profile_id = public.current_profile_id()
    or public.is_manager_of(target_profile_id)
    or exists (
      select 1
      from public.probation_checkpoints checkpoints
      join public.probation_cases cases on cases.id = checkpoints.probation_case_id
      where checkpoints.id = feedback_submissions.related_checkpoint_id
        and cases.manager_profile_id = public.current_profile_id()
    )
  )
);

-- Probation checkpoints move forward when either party submits feedback.
create policy "probation_checkpoints_update_access"
on public.probation_checkpoints
for update
to authenticated
using (
  exists (
    select 1
    from public.probation_cases
    where probation_cases.id = probation_checkpoints.probation_case_id
      and (
        public.has_role('admin')
        or probation_cases.profile_id = public.current_profile_id()
        or probation_cases.manager_profile_id = public.current_profile_id()
      )
  )
);

-- Probation outcomes are HR decisions.
create policy "probation_cases_update_admin"
on public.probation_cases
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "probation_decisions_insert_admin"
on public.probation_decisions
for insert
to authenticated
with check (
  public.has_role('admin')
  and actor_profile_id = public.current_profile_id()
);

create policy "employee_records_update_admin"
on public.employee_records
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

-- Reviews: your own self review, a manager review you are the reviewer
-- for, or Admin.
create policy "review_submissions_insert_access"
on public.review_submissions
for insert
to authenticated
with check (
  public.has_role('admin')
  or (submission_type = 'self_review' and profile_id = public.current_profile_id())
  or (
    submission_type = 'manager_review'
    and reviewer_profile_id = public.current_profile_id()
    and public.is_manager_of(profile_id)
  )
);

create policy "review_submissions_update_access"
on public.review_submissions
for update
to authenticated
using (
  public.has_role('admin')
  or (submission_type = 'self_review' and profile_id = public.current_profile_id())
  or (submission_type = 'manager_review' and reviewer_profile_id = public.current_profile_id())
)
with check (
  public.has_role('admin')
  or (submission_type = 'self_review' and profile_id = public.current_profile_id())
  or (submission_type = 'manager_review' and reviewer_profile_id = public.current_profile_id())
);

-- Enrollment status follows submissions by the employee or their reviewer.
create policy "cycle_enrollments_update_access"
on public.cycle_enrollments
for update
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or manager_profile_id = public.current_profile_id()
)
with check (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or manager_profile_id = public.current_profile_id()
);

create policy "cycle_enrollments_insert_admin"
on public.cycle_enrollments
for insert
to authenticated
with check (public.has_role('admin'));

-- Review cycles are set up by Admin.
create policy "review_cycles_insert_admin"
on public.review_cycles
for insert
to authenticated
with check (public.has_role('admin'));

create policy "review_cycles_update_admin"
on public.review_cycles
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));
