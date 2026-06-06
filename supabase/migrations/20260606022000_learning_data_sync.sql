create table public.yll_wordbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  local_user_id text not null,
  name text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table public.yll_vocab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  local_user_id text not null,
  wordbook_local_id text,
  text text not null,
  normalized_text text not null,
  language text not null default 'en',
  meaning text,
  source_sentence text,
  translated_sentence text,
  video_id text,
  cue_id text,
  mastery integer not null default 0 check (mastery between 0 and 5),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table public.yll_sentence_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  local_user_id text not null,
  video_id text not null,
  cue_id text not null,
  text text not null,
  translated_text text,
  language text not null,
  start_ms integer not null,
  duration_ms integer not null,
  note text,
  is_favorite boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table public.yll_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  local_user_id text not null,
  practice_item_id text not null,
  cue_id text not null,
  mode text not null check (mode in ('shadowing', 'dictation', 'cloze', 'quiz')),
  answer text,
  expected text not null,
  score integer not null,
  speech_score jsonb,
  duration_ms integer not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table public.yll_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default 'settings',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create index yll_wordbooks_user_updated_idx
  on public.yll_wordbooks (user_id, updated_at desc);

create index yll_vocab_items_user_wordbook_idx
  on public.yll_vocab_items (user_id, wordbook_local_id, updated_at desc);

create index yll_vocab_items_user_text_idx
  on public.yll_vocab_items (user_id, normalized_text);

create index yll_sentence_notes_user_video_idx
  on public.yll_sentence_notes (user_id, video_id, start_ms);

create index yll_practice_attempts_user_created_idx
  on public.yll_practice_attempts (user_id, created_at desc);

create trigger yll_wordbooks_set_updated_at
before update on public.yll_wordbooks
for each row execute function public.set_updated_at();

create trigger yll_vocab_items_set_updated_at
before update on public.yll_vocab_items
for each row execute function public.set_updated_at();

create trigger yll_sentence_notes_set_updated_at
before update on public.yll_sentence_notes
for each row execute function public.set_updated_at();

alter table public.yll_wordbooks enable row level security;
alter table public.yll_vocab_items enable row level security;
alter table public.yll_sentence_notes enable row level security;
alter table public.yll_practice_attempts enable row level security;
alter table public.yll_settings enable row level security;

create policy yll_wordbooks_own_all
on public.yll_wordbooks
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy yll_vocab_items_own_all
on public.yll_vocab_items
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy yll_sentence_notes_own_all
on public.yll_sentence_notes
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy yll_practice_attempts_own_all
on public.yll_practice_attempts
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy yll_settings_own_all
on public.yll_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.yll_wordbooks to authenticated;
grant select, insert, update, delete on public.yll_vocab_items to authenticated;
grant select, insert, update, delete on public.yll_sentence_notes to authenticated;
grant select, insert, update, delete on public.yll_practice_attempts to authenticated;
grant select, insert, update, delete on public.yll_settings to authenticated;
