insert into public.teams (id, name, department)
values
  ('11111111-1111-4111-8111-111111111111', 'Platform Operations', 'Technology'),
  ('22222222-2222-4222-8222-222222222222', 'Customer Success', 'Customer Operations')
on conflict (id) do nothing;

insert into public.profiles (
  id,
  employee_code,
  full_name,
  email,
  title,
  department,
  team_id,
  review_track,
  manager_profile_id,
  date_of_joining
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'HR-001', 'Nushra Ali', 'nushra.hr@pms.local', 'Admin (HR)', 'People Operations', '11111111-1111-4111-8111-111111111111', 'biannual', null, '2023-02-13'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'MGR-001', 'Maya Singh', 'maya.singh@pms.local', 'Engineering Manager', 'Technology', '11111111-1111-4111-8111-111111111111', 'biannual', null, '2022-08-01'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'MGR-002', 'Arjun Mehta', 'arjun.mehta@pms.local', 'Customer Success Lead', 'Customer Operations', '22222222-2222-4222-8222-222222222222', 'quarterly', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2023-01-09'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'EMP-001', 'Aanya Patel', 'aanya.patel@pms.local', 'Frontend Engineer', 'Technology', '11111111-1111-4111-8111-111111111111', 'biannual', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2024-01-15'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'EMP-002', 'Rohan Kapoor', 'rohan.kapoor@pms.local', 'Backend Engineer', 'Technology', '11111111-1111-4111-8111-111111111111', 'biannual', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2024-02-12'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'EMP-003', 'Neha Iyer', 'neha.iyer@pms.local', 'Customer Success Associate', 'Customer Operations', '22222222-2222-4222-8222-222222222222', 'quarterly', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '2026-01-06')
on conflict (id) do nothing;

update public.teams
set lead_profile_id = case
  when id = '11111111-1111-4111-8111-111111111111' then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid
  when id = '22222222-2222-4222-8222-222222222222' then 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid
  else lead_profile_id
end
where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

insert into public.user_roles (profile_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'manager'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'manager'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'employee'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'employee'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'employee'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'employee')
on conflict (profile_id, role) do nothing;

insert into public.employee_records (
  profile_id,
  probation_status,
  employment_status,
  review_track,
  department
)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'completed', 'active', 'biannual', 'Technology'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'completed', 'active', 'quarterly', 'Customer Operations'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'completed', 'active', 'biannual', 'Technology'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'completed', 'active', 'biannual', 'Technology'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'paused', 'active', 'quarterly', 'Customer Operations')
on conflict (profile_id) do nothing;

insert into public.manager_assignments (
  employee_profile_id,
  manager_profile_id,
  effective_from,
  is_primary
)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2023-01-09', true),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2024-01-15', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2024-02-12', true),
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '2026-01-06', true)
on conflict do nothing;

insert into public.leave_periods (profile_id, start_date, end_date, reason)
values
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', '2026-03-24', '2026-03-28', 'Medical leave')
on conflict do nothing;

insert into public.app_settings (
  singleton,
  red_flag_threshold,
  goal_approval_escalation_business_days,
  probation_escalation_days,
  secondary_admin_profile_id,
  successor_admin_profile_id
)
values
  (true, 2, 5, 7, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')
on conflict (singleton) do update
set
  red_flag_threshold = excluded.red_flag_threshold,
  goal_approval_escalation_business_days = excluded.goal_approval_escalation_business_days,
  probation_escalation_days = excluded.probation_escalation_days,
  secondary_admin_profile_id = excluded.secondary_admin_profile_id,
  successor_admin_profile_id = excluded.successor_admin_profile_id;

insert into public.review_cycles (
  id,
  label,
  cycle_type,
  goal_window_label,
  trigger_date,
  close_date,
  finalize_from,
  is_active
)
values
  ('12121212-1212-4212-8212-121212121212', 'Bi-Annual Cycle 1', 'biannual', 'April-September 2026', '2026-08-01', '2026-08-25', '2026-08-26', false),
  ('34343434-3434-4343-8434-343434343434', 'Quarterly Q2', 'quarterly', 'April-June 2026', '2026-07-01', '2026-07-15', null, true)
on conflict (id) do nothing;

insert into public.cycle_enrollments (
  id,
  cycle_id,
  profile_id,
  manager_profile_id,
  review_status,
  discussion_status,
  final_rating
)
values
  ('51515151-5151-4515-8515-515151515151', '12121212-1212-4212-8212-121212121212', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'in_progress', 'scheduled', null),
  ('61616161-6161-4616-8616-616161616161', '12121212-1212-4212-8212-121212121212', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'submitted', 'completed', 'meets_expectations'),
  ('71717171-7171-4717-8717-717171717171', '34343434-3434-4343-8434-343434343434', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'not_started', 'not_scheduled', null),
  ('81818181-8181-4818-8818-818181818181', '34343434-3434-4343-8434-343434343434', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'in_progress', 'scheduled', null)
on conflict (id) do nothing;

insert into public.goals (
  id,
  title,
  summary,
  owner_profile_id,
  scope,
  status,
  weightage,
  completion_pct,
  cycle_id,
  parent_goal_id,
  created_by,
  approved_by,
  approved_at,
  due_date
)
values
  ('91919191-9191-4919-8919-919191919191', 'Improve customer workflow reliability', 'Reduce manual performance tracking gaps by centralizing workflows.', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'company', 'active', 100, 58, '34343434-3434-4343-8434-343434343434', null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2026-03-28T09:15:00Z', '2026-06-30'),
  ('92929292-9292-4929-8929-929292929292', 'Ship manager visibility dashboard', 'Give managers live views of approvals, overdue forms, and review status.', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'team', 'active', 100, 64, '34343434-3434-4343-8434-343434343434', '91919191-9191-4919-8919-919191919191', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2026-04-01T08:10:00Z', '2026-06-24'),
  ('93939393-9393-4939-8939-939393939393', 'Deliver employee goal drafting experience', 'Enable employees to draft, submit, and revise goals with manager feedback.', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'individual', 'active', 55, 72, '34343434-3434-4343-8434-343434343434', '92929292-9292-4929-8929-929292929292', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-04-02T10:00:00Z', '2026-06-18'),
  ('94949494-9494-4949-8949-949494949494', 'Implement reminder escalation workflow', 'Cover probation reminders and approval escalations with audit trails.', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'individual', 'pending_approval', 45, 20, '34343434-3434-4343-8434-343434343434', '92929292-9292-4929-8929-929292929292', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', null, null, '2026-06-29'),
  ('95959595-9595-4959-8959-959595959595', 'Finalize PMS relational data model', 'Model goals, cycles, probation, and flags in a single audit-friendly schema.', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'individual', 'active', 100, 61, '34343434-3434-4343-8434-343434343434', '92929292-9292-4929-8929-929292929292', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-04-03T11:30:00Z', '2026-06-20'),
  ('96969696-9696-4969-8969-969696969696', 'Complete customer onboarding quality review', 'Improve onboarding handoff quality and reduce repeat customer touchpoints.', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'individual', 'active', 60, 40, '34343434-3434-4343-8434-343434343434', null, 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '2026-04-05T06:45:00Z', '2026-06-22'),
  ('97979797-9797-4979-8979-979797979797', 'Build escalation playbook for repeat flags', 'Document response patterns for customers with repeated issues.', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'individual', 'draft', 40, 0, '34343434-3434-4343-8434-343434343434', null, 'ffffffff-ffff-4fff-8fff-fffffffffff1', null, null, '2026-06-27')
on conflict (id) do nothing;

insert into public.goal_updates (goal_id, posted_by, kind, body, created_at)
values
  ('93939393-9393-4939-8939-939393939393', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'progress', 'Completed first-pass approval queue wireframes and server-side role guards.', '2026-04-10T13:30:00Z'),
  ('94949494-9494-4949-8949-949494949494', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'blocker', 'Need final rules for business-day handling before locking the scheduler logic.', '2026-04-14T09:50:00Z'),
  ('96969696-9696-4969-8969-969696969696', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'nudge', 'Please attach the customer-call summary before the Day 60 checkpoint closes.', '2026-04-11T07:05:00Z')
on conflict do nothing;

insert into public.goal_approval_events (goal_id, action, actor_profile_id, notes, created_at)
values
  ('94949494-9494-4949-8949-949494949494', 'submit', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Ready for manager review with updated timeline assumptions.', '2026-04-12T14:05:00Z'),
  ('97979797-9797-4979-8979-979797979797', 'submit', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'Draft shared for early coaching before formal approval.', '2026-04-15T08:30:00Z')
on conflict do nothing;

insert into public.probation_cases (
  id,
  profile_id,
  manager_profile_id,
  status,
  confirmation_call_date,
  admin_owner_profile_id
)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'paused', '2026-05-06', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'completed', '2024-05-15', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
on conflict (id) do nothing;

insert into public.probation_checkpoints (
  id,
  probation_case_id,
  checkpoint_type,
  form_title,
  due_date,
  revised_due_date,
  status
)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'day_30', 'Initial check-in', '2026-02-17', null, 'shared'),
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'day_60', 'Mid-probation review', '2026-03-31', '2026-04-07', 'waiting_for_manager'),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'day_80', 'Final pre-confirmation review', '2026-04-28', '2026-05-05', 'blocked')
on conflict (id) do nothing;

insert into public.feedback_submissions (
  id,
  workflow_type,
  request_label,
  submitted_by,
  target_profile_id,
  related_checkpoint_id,
  related_cycle_id,
  score,
  comments
)
values
  ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', 'probation', 'Day 60 self-feedback', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', null, 2, 'I need more clarity on cross-team escalation expectations.'),
  ('1111aaaa-2222-4333-8444-555566667777', 'cycle_review', 'Bi-Annual self-review', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', null, '12121212-1212-4212-8212-121212121212', 4, 'Delivered the schema foundation and ownership transfer support.'),
  ('9999aaaa-8888-4777-8666-555544443333', 'probation', 'Day 30 manager feedback', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', null, 3, '')
on conflict (id) do nothing;

insert into public.review_submissions (
  id,
  cycle_id,
  profile_id,
  reviewer_profile_id,
  submission_type,
  status,
  rating,
  comments,
  submitted_at
)
values
  ('2222aaaa-3333-4444-8555-666677778888', '12121212-1212-4212-8212-121212121212', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'self_review', 'submitted', 'meets_expectations', 'Solid delivery on employee experience foundations.', '2026-08-08T10:10:00Z'),
  ('3333aaaa-4444-4555-8666-777788889999', '12121212-1212-4212-8212-121212121212', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'manager_review', 'finalized', 'meets_expectations', 'Strong data-model execution and dependable delivery.', '2026-08-21T08:50:00Z')
on conflict (id) do nothing;

insert into public.flags (
  id,
  submission_id,
  employee_profile_id,
  severity,
  status,
  reason,
  aged_at
)
values
  ('4444aaaa-5555-4666-8777-88889999aaaa', 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'high', 'under_review', 'Repeat low-score signal across consecutive checkpoints.', '2026-04-09T09:00:00Z'),
  ('5555aaaa-6666-4777-8888-9999aaaabbbb', '9999aaaa-8888-4777-8666-555544443333', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'soft', 'open', 'Blank open-ended response from manager feedback.', '2026-02-18T06:45:00Z')
on conflict (id) do nothing;

insert into public.flag_actions (flag_id, actor_profile_id, action, notes)
values
  ('4444aaaa-5555-4666-8777-88889999aaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'review', 'Admin opened repeat-flag review and assigned follow-up owner.')
on conflict do nothing;

insert into public.notifications (id, audience_role, title, body, status, sent_at)
values
  ('6666aaaa-7777-4888-8999-aaaabbbbcccc', 'manager', 'Goal approval pending', 'Aanya submitted a reminder-engine goal that needs review within 5 business days.', 'queued', null),
  ('7777aaaa-8888-4999-8aaa-bbbbccccdddd', 'admin', 'Probation checkpoint escalation', 'Neha''s Day 60 manager submission is overdue and requires Admin visibility.', 'sent', '2026-04-14T07:00:00Z'),
  ('8888aaaa-9999-4aaa-8bbb-ccccddddeeee', 'employee', 'Goal approval update', 'You will receive approval status changes here and by email.', 'queued', null)
on conflict (id) do nothing;

insert into public.audit_logs (actor_profile_id, entity_type, entity_id, action, summary)
values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'goal', '94949494-9494-4949-8949-949494949494', 'submit', 'Employee submitted reminder escalation goal for manager approval.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'flag', '4444aaaa-5555-4666-8777-88889999aaaa', 'review', 'Admin opened repeat-flag review and assigned follow-up owner.'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'probation_checkpoint', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'blocked', 'Checkpoint blocked pending manager reassignment clarification.')
on conflict do nothing;

insert into public.probation_decisions (probation_case_id, decision, actor_profile_id, notes)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'confirm', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Completed probation successfully after final review discussion.')
on conflict do nothing;
