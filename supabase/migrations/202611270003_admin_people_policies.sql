-- Let Admin manage people from the People screen when RLS is enforced:
-- roles, manager assignments and profile details. Nobody else gets write
-- access to these tables, so users still cannot change their own role or
-- reporting line.

create policy "user_roles_admin_insert"
on public.user_roles
for insert
to authenticated
with check (public.has_role('admin'));

create policy "user_roles_admin_delete"
on public.user_roles
for delete
to authenticated
using (public.has_role('admin'));

create policy "manager_assignments_admin_insert"
on public.manager_assignments
for insert
to authenticated
with check (public.has_role('admin'));

create policy "manager_assignments_admin_update"
on public.manager_assignments
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));
