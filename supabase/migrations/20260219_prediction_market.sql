-- PPulse prediction market (point-based) schema

create extension if not exists pgcrypto;

create table if not exists public.prediction_markets (
  id uuid primary key default gen_random_uuid(),
  market_key text not null unique,
  sub_category text not null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'locked', 'resolved', 'cancelled')),
  resolve_rule jsonb not null default '{}'::jsonb,
  open_at timestamptz not null default now(),
  lock_at timestamptz not null,
  resolve_at timestamptz not null,
  baseline_score integer not null,
  resolved_score integer,
  outcome text check (outcome in ('up', 'down', 'void')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prediction_markets_sub_status
  on public.prediction_markets (sub_category, status, resolve_at);

create table if not exists public.prediction_positions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.prediction_markets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  side text not null check (side in ('up', 'down')),
  stake_points integer not null check (stake_points > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_prediction_positions_unique_user
  on public.prediction_positions (market_id, user_id);

create index if not exists idx_prediction_positions_market
  on public.prediction_positions (market_id, side);

create table if not exists public.user_points_wallet (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 1000 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('seed', 'stake_lock', 'payout', 'refund', 'admin_adjust')),
  delta integer not null,
  balance_after integer not null,
  ref_type text,
  ref_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_points_ledger_user_created
  on public.user_points_ledger (user_id, created_at desc);

create table if not exists public.user_prediction_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  resolved_count integer not null default 0,
  win_count integer not null default 0,
  hit_rate numeric(5,2) not null default 0,
  total_pnl integer not null default 0,
  rating integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_prediction_stats_total_pnl
  on public.user_prediction_stats (total_pnl desc, hit_rate desc);

create table if not exists public.prediction_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.prediction_markets (id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  up_count integer not null default 0,
  down_count integer not null default 0,
  up_points integer not null default 0,
  down_points integer not null default 0
);

create index if not exists idx_prediction_market_snapshots_market_time
  on public.prediction_market_snapshots (market_id, snapshot_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prediction_markets_updated_at on public.prediction_markets;
create trigger trg_prediction_markets_updated_at
before update on public.prediction_markets
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_points_wallet_updated_at on public.user_points_wallet;
create trigger trg_user_points_wallet_updated_at
before update on public.user_points_wallet
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_prediction_stats_updated_at on public.user_prediction_stats;
create trigger trg_user_prediction_stats_updated_at
before update on public.user_prediction_stats
for each row
execute function public.set_updated_at();

alter table public.prediction_markets enable row level security;
alter table public.prediction_positions enable row level security;
alter table public.user_points_wallet enable row level security;
alter table public.user_points_ledger enable row level security;
alter table public.user_prediction_stats enable row level security;
alter table public.prediction_market_snapshots enable row level security;

drop policy if exists "prediction_markets_select_authenticated" on public.prediction_markets;
create policy "prediction_markets_select_authenticated"
  on public.prediction_markets
  for select
  to authenticated
  using (true);

drop policy if exists "prediction_positions_select_own" on public.prediction_positions;
create policy "prediction_positions_select_own"
  on public.prediction_positions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "prediction_positions_insert_own" on public.prediction_positions;
create policy "prediction_positions_insert_own"
  on public.prediction_positions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_points_wallet_select_own" on public.user_points_wallet;
create policy "user_points_wallet_select_own"
  on public.user_points_wallet
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_points_wallet_insert_own" on public.user_points_wallet;
create policy "user_points_wallet_insert_own"
  on public.user_points_wallet
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_points_wallet_update_own" on public.user_points_wallet;
create policy "user_points_wallet_update_own"
  on public.user_points_wallet
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_points_ledger_select_own" on public.user_points_ledger;
create policy "user_points_ledger_select_own"
  on public.user_points_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_points_ledger_insert_own" on public.user_points_ledger;
create policy "user_points_ledger_insert_own"
  on public.user_points_ledger
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_prediction_stats_select_authenticated" on public.user_prediction_stats;
create policy "user_prediction_stats_select_authenticated"
  on public.user_prediction_stats
  for select
  to authenticated
  using (true);

drop policy if exists "prediction_market_snapshots_select_authenticated" on public.prediction_market_snapshots;
create policy "prediction_market_snapshots_select_authenticated"
  on public.prediction_market_snapshots
  for select
  to authenticated
  using (true);

grant select on public.prediction_markets to authenticated;
grant select, insert on public.prediction_positions to authenticated;
grant select, insert, update on public.user_points_wallet to authenticated;
grant select, insert on public.user_points_ledger to authenticated;
grant select on public.user_prediction_stats to authenticated;
grant select on public.prediction_market_snapshots to authenticated;
