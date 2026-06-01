create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  auth_provider text not null default 'email'
    check (auth_provider in ('email', 'google')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null default 'pro' check (plan in ('pro')),
  status text not null check (
    status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (
    feature in ('translate', 'explain', 'speechScore', 'practiceGenerate')
  ),
  cost integer not null check (cost > 0 and cost <= 5000),
  status text not null check (status in ('success', 'failed', 'skipped')),
  usage_date date not null default (timezone('utc', now())::date),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_customers_stripe_customer_id_idx
  on public.billing_customers (stripe_customer_id);

create index subscriptions_user_status_period_idx
  on public.subscriptions (user_id, status, current_period_end desc);

create index subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create index usage_events_user_date_status_idx
  on public.usage_events (user_id, usage_date, status);

create index usage_events_user_feature_date_idx
  on public.usage_events (user_id, feature, usage_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger billing_customers_set_updated_at
before update on public.billing_customers
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    email,
    display_name,
    avatar_url,
    auth_provider
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when new.raw_app_meta_data ->> 'provider' = 'google' then 'google'
      else 'email'
    end
  )
  on conflict (user_id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    auth_provider = excluded.auth_provider,
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy billing_customers_select_own
on public.billing_customers
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy usage_events_select_own
on public.usage_events
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select on public.billing_customers to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.usage_events to authenticated;
