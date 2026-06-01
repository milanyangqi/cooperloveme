create table public.entitlement_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('free', 'pro')),
  features jsonb,
  quota jsonb,
  expires_at timestamptz,
  is_enabled boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entitlement_overrides_enabled_expires_idx
  on public.entitlement_overrides (is_enabled, expires_at);

create trigger entitlement_overrides_set_updated_at
before update on public.entitlement_overrides
for each row execute function public.set_updated_at();

alter table public.entitlement_overrides enable row level security;
