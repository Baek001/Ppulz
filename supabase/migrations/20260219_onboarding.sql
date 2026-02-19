-- PPulse onboarding + example cards schema

create extension if not exists pgcrypto;

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  big_categories jsonb not null default '[]'::jsonb,
  sub_categories jsonb not null default '[]'::jsonb,
  example_checked jsonb not null default '[]'::jsonb,
  onboarding_state text not null default 'categories_selected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_onboarding_state_check check (
    onboarding_state in ('categories_selected', 'subcategories_selected', 'examples_done', 'completed')
  ),
  constraint user_onboarding_big_categories_check check (
    jsonb_typeof(big_categories) = 'array'
    and jsonb_array_length(big_categories) between 0 and 3
  ),
  constraint user_onboarding_sub_categories_check check (
    jsonb_typeof(sub_categories) = 'array'
    and jsonb_array_length(sub_categories) between 0 and 5
  ),
  constraint user_onboarding_example_checked_check check (
    jsonb_typeof(example_checked) = 'array'
    and jsonb_array_length(example_checked) between 0 and 6
  )
);

create table if not exists public.example_cards (
  card_id text primary key,
  card_type text not null check (card_type in ('news', 'bill')),
  big_category text not null,
  sub_category text not null,
  title text not null,
  description text not null,
  default_label text null check (default_label is null or default_label in ('기회', '위험', '중립')),
  country_hint text null check (country_hint is null or country_hint in ('한국', '미국')),
  bill_stage text null check (bill_stage is null or bill_stage in ('발의', '심사', '통과', '시행')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_onboarding_updated_at on public.user_onboarding;
create trigger trg_user_onboarding_updated_at
before update on public.user_onboarding
for each row
execute function public.set_updated_at();

alter table public.user_onboarding enable row level security;
alter table public.example_cards enable row level security;

drop policy if exists "user_onboarding_select_own" on public.user_onboarding;
create policy "user_onboarding_select_own"
  on public.user_onboarding
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_onboarding_insert_own" on public.user_onboarding;
create policy "user_onboarding_insert_own"
  on public.user_onboarding
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_onboarding_update_own" on public.user_onboarding;
create policy "user_onboarding_update_own"
  on public.user_onboarding
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "example_cards_select_authenticated" on public.example_cards;
create policy "example_cards_select_authenticated"
  on public.example_cards
  for select
  to authenticated
  using (true);

grant select, insert, update on public.user_onboarding to authenticated;
grant select on public.example_cards to authenticated;
