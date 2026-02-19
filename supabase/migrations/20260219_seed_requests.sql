-- Seed request queue for dashboard analysis

create table if not exists public.seed_requests (
  sub_category text primary key,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_seed_requests_status_time
  on public.seed_requests (status, requested_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_seed_requests_updated_at on public.seed_requests;
create trigger trg_seed_requests_updated_at
before update on public.seed_requests
for each row
execute function public.set_updated_at();

alter table public.seed_requests enable row level security;
