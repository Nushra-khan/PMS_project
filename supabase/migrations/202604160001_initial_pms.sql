create extension if not exists pgcrypto;

create type public.app_role as enum ('employee', 'manager', 'admin');
create type public.review_track as enum ('biannual', 'quarterly');
create type public.goal_scope as enum ('company', 'team', 'individual');
create type public.goal_status as enum ('draft', 'pending_approval', 'active', 'completed', 'archived');
create type public.probation_status as enum ('active', 'paused', 'completed', 'terminated', 'extended');
create type public.checkpoint_type as enum ('day_30', 'day_60', 'day_80');
create type public.checkpoint_status as enum ('waiting_for_employee', 'waiting_for_manager', 'ready_for_cross_share', 'shared', 'waived', 'blocked', 'cancelled');
create type public.cycle_type as enum ('biannual', 'quarterly');
create type public.review_status as enum ('not_started', 'in_progress', 'submitted', 'overdue', 'waived', 'finalized');
create type public.discussion_status as enum ('not_scheduled', 'scheduled', 'completed');
create type public.rating_value as enum ('below_expectations', 'meets_expectations', 'above_expectations');
create type public.flag_severity as enum ('soft', 'medium', 'high');
create type public.flag_status as enum ('open', 'under_review', 'escalated', 'resolved');
create type public.notification_status as enum ('queued', 'sent', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  lead_profile_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  employee_code text unique,
  full_name text not null,
  email text not null unique,
  title text not null,
  department text not null,
  team_id uuid references public.teams(id),
  review_track public.review_track not null default 'biannual',
  manager_profile_id uuid references public.profiles(id),
  date_of_joining date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.teams
  add constraint teams_lead_profile_fk
  foreign key (lead_profile_id)
  references public.profiles(id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, role)
);

create table public.employee_records (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  probation_status public.probation_status not null default 'active',
  employment_status text not null default 'active',
  review_track public.review_track not null,
  department text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.manager_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_profile_id uuid not null references public.profiles(id) on delete cascade,
  manager_profile_id uuid not null references public.profiles(id),
  effective_from date not null,
  effective_to date,
  is_primary boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.leave_periods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  red_flag_threshold integer not null default 2 check (red_flag_threshold between 1 and 5),
  goal_approval_escalation_business_days integer not null default 5,
  probation_escalation_days integer not null default 7,
  secondary_admin_profile_id uuid references public.profiles(id),
  successor_admin_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  cycle_type public.cycle_type not null,
  goal_window_label text not null,
  trigger_date date not null,
  close_date date not null,
  finalize_from date,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.cycle_enrollments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  manager_profile_id uuid not null references public.profiles(id),
  review_status public.review_status not null default 'not_started',
  discussion_status public.discussion_status not null default 'not_scheduled',
  final_rating public.rating_value,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cycle_id, profile_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  scope public.goal_scope not null,
  status public.goal_status not null default 'draft',
  weightage numeric(5,2) not null default 0 check (weightage >= 0 and weightage <= 100),
  completion_pct numeric(5,2) not null default 0 check (completion_pct >= 0 and completion_pct <= 100),
  cycle_id uuid references public.review_cycles(id),
  parent_goal_id uuid references public.goals(id),
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  due_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  posted_by uuid not null references public.profiles(id),
  kind text not null check (kind in ('progress', 'blocker', 'nudge', 'completion')),
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.goal_approval_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  action text not null check (action in ('submit', 'approve', 'reject', 'resubmit', 'archive')),
  actor_profile_id uuid not null references public.profiles(id),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.probation_cases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  manager_profile_id uuid references public.profiles(id),
  status public.probation_status not null default 'active',
  confirmation_call_date date,
  admin_owner_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id)
);

create table public.probation_checkpoints (
  id uuid primary key default gen_random_uuid(),
  probation_case_id uuid not null references public.probation_cases(id) on delete cascade,
  checkpoint_type public.checkpoint_type not null,
  form_title text not null,
  due_date date not null,
  revised_due_date date,
  status public.checkpoint_status not null default 'waiting_for_employee',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (probation_case_id, checkpoint_type)
);

create table public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null check (workflow_type in ('probation', 'cycle_review')),
  request_kind text not null check (request_kind in ('employee', 'manager')),
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id),
  related_checkpoint_id uuid references public.probation_checkpoints(id) on delete cascade,
  related_cycle_id uuid references public.review_cycles(id) on delete cascade,
  due_date date not null,
  status public.review_status not null default 'not_started',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null check (workflow_type in ('probation', 'cycle_review')),
  request_label text not null,
  submitted_by uuid not null references public.profiles(id),
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  related_checkpoint_id uuid references public.probation_checkpoints(id) on delete cascade,
  related_cycle_id uuid references public.review_cycles(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comments text not null default '',
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id),
  submission_type text not null check (submission_type in ('self_review', 'manager_review')),
  status public.review_status not null default 'not_started',
  rating public.rating_value,
  comments text not null default '',
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.feedback_submissions(id) on delete cascade,
  employee_profile_id uuid not null references public.profiles(id) on delete cascade,
  severity public.flag_severity not null,
  status public.flag_status not null default 'open',
  reason text not null,
  aged_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.flag_actions (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references public.flags(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id),
  action text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience_role public.app_role not null,
  title text not null,
  body text not null,
  status public.notification_status not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email', 'in_app')),
  recipient_email text,
  status public.notification_status not null default 'queued',
  retry_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.probation_decisions (
  id uuid primary key default gen_random_uuid(),
  probation_case_id uuid not null references public.probation_cases(id) on delete cascade,
  decision text not null check (decision in ('confirm', 'extend_probation', 'review_further')),
  actor_profile_id uuid not null references public.profiles(id),
  notes text,
  decided_at timestamptz not null default timezone('utc', now())
);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_employee_records_updated_at before update on public.employee_records for each row execute function public.set_updated_at();
create trigger set_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
create trigger set_review_cycles_updated_at before update on public.review_cycles for each row execute function public.set_updated_at();
create trigger set_cycle_enrollments_updated_at before update on public.cycle_enrollments for each row execute function public.set_updated_at();
create trigger set_goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger set_probation_cases_updated_at before update on public.probation_cases for each row execute function public.set_updated_at();
create trigger set_probation_checkpoints_updated_at before update on public.probation_checkpoints for each row execute function public.set_updated_at();
create trigger set_feedback_requests_updated_at before update on public.feedback_requests for each row execute function public.set_updated_at();
create trigger set_review_submissions_updated_at before update on public.review_submissions for each row execute function public.set_updated_at();
create trigger set_flags_updated_at before update on public.flags for each row execute function public.set_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role(target_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where profile_id = public.current_profile_id()
      and role = target_role
  );
$$;

create or replace function public.is_manager_of(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manager_assignments
    where employee_profile_id = target_profile
      and manager_profile_id = public.current_profile_id()
      and (effective_to is null or effective_to >= current_date)
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.employee_records enable row level security;
alter table public.manager_assignments enable row level security;
alter table public.leave_periods enable row level security;
alter table public.app_settings enable row level security;
alter table public.review_cycles enable row level security;
alter table public.cycle_enrollments enable row level security;
alter table public.goals enable row level security;
alter table public.goal_updates enable row level security;
alter table public.goal_approval_events enable row level security;
alter table public.probation_cases enable row level security;
alter table public.probation_checkpoints enable row level security;
alter table public.feedback_requests enable row level security;
alter table public.feedback_submissions enable row level security;
alter table public.review_submissions enable row level security;
alter table public.flags enable row level security;
alter table public.flag_actions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.probation_decisions enable row level security;

create policy "profiles_select_access"
on public.profiles
for select
to authenticated
using (
  public.has_role('admin')
  or id = public.current_profile_id()
  or public.is_manager_of(id)
);

create policy "user_roles_select_access"
on public.user_roles
for select
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
);

create policy "employee_records_select_access"
on public.employee_records
for select
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or public.is_manager_of(profile_id)
);

create policy "manager_assignments_select_access"
on public.manager_assignments
for select
to authenticated
using (
  public.has_role('admin')
  or employee_profile_id = public.current_profile_id()
  or manager_profile_id = public.current_profile_id()
);

create policy "leave_periods_select_access"
on public.leave_periods
for select
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or public.is_manager_of(profile_id)
);

create policy "app_settings_admin_readwrite"
on public.app_settings
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "review_cycles_select_access"
on public.review_cycles
for select
to authenticated
using (true);

create policy "cycle_enrollments_select_access"
on public.cycle_enrollments
for select
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or public.is_manager_of(profile_id)
);

create policy "goals_select_access"
on public.goals
for select
to authenticated
using (
  public.has_role('admin')
  or scope = 'company'
  or owner_profile_id = public.current_profile_id()
  or public.is_manager_of(owner_profile_id)
);

create policy "goals_write_access"
on public.goals
for all
to authenticated
using (
  public.has_role('admin')
  or owner_profile_id = public.current_profile_id()
  or public.is_manager_of(owner_profile_id)
)
with check (
  public.has_role('admin')
  or owner_profile_id = public.current_profile_id()
  or public.is_manager_of(owner_profile_id)
);

create policy "goal_updates_select_access"
on public.goal_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.goals
    where goals.id = goal_updates.goal_id
      and (
        public.has_role('admin')
        or goals.scope = 'company'
        or goals.owner_profile_id = public.current_profile_id()
        or public.is_manager_of(goals.owner_profile_id)
      )
  )
);

create policy "goal_approval_events_select_access"
on public.goal_approval_events
for select
to authenticated
using (
  exists (
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

create policy "probation_cases_select_access"
on public.probation_cases
for select
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or manager_profile_id = public.current_profile_id()
);

create policy "probation_checkpoints_select_access"
on public.probation_checkpoints
for select
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

create policy "feedback_requests_select_access"
on public.feedback_requests
for select
to authenticated
using (
  public.has_role('admin')
  or target_profile_id = public.current_profile_id()
  or reviewer_profile_id = public.current_profile_id()
  or public.is_manager_of(target_profile_id)
);

create policy "feedback_submissions_select_access"
on public.feedback_submissions
for select
to authenticated
using (
  public.has_role('admin')
  or target_profile_id = public.current_profile_id()
  or submitted_by = public.current_profile_id()
  or public.is_manager_of(target_profile_id)
);

create policy "review_submissions_select_access"
on public.review_submissions
for select
to authenticated
using (
  public.has_role('admin')
  or profile_id = public.current_profile_id()
  or reviewer_profile_id = public.current_profile_id()
  or public.is_manager_of(profile_id)
);

create policy "flags_select_access"
on public.flags
for select
to authenticated
using (
  public.has_role('admin')
  or public.is_manager_of(employee_profile_id)
);

create policy "flag_actions_select_access"
on public.flag_actions
for select
to authenticated
using (
  public.has_role('admin')
  or exists (
    select 1
    from public.flags
    where flags.id = flag_actions.flag_id
      and public.is_manager_of(flags.employee_profile_id)
  )
);

create policy "notifications_select_access"
on public.notifications
for select
to authenticated
using (
  public.has_role('admin')
  or audience_role in (
    select role
    from public.user_roles
    where profile_id = public.current_profile_id()
  )
);

create policy "notification_deliveries_admin_only"
on public.notification_deliveries
for select
to authenticated
using (public.has_role('admin'));

create policy "audit_logs_select_access"
on public.audit_logs
for select
to authenticated
using (
  public.has_role('admin')
  or actor_profile_id = public.current_profile_id()
);

create policy "probation_decisions_select_access"
on public.probation_decisions
for select
to authenticated
using (
  public.has_role('admin')
  or exists (
    select 1
    from public.probation_cases
    where probation_cases.id = probation_decisions.probation_case_id
      and (
        probation_cases.profile_id = public.current_profile_id()
        or probation_cases.manager_profile_id = public.current_profile_id()
      )
  )
);
