create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'viewer')),
  is_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_users_enabled_role_idx
  on public.admin_users (is_enabled, role);

create index admin_audit_logs_target_created_idx
  on public.admin_audit_logs (target_user_id, created_at desc);

create index admin_audit_logs_actor_created_idx
  on public.admin_audit_logs (actor_user_id, created_at desc);

create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy admin_users_select_own
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy admin_audit_logs_select_active_admins
on public.admin_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.is_enabled = true
  )
);

grant select on public.admin_users to authenticated;
grant select on public.admin_audit_logs to authenticated;
