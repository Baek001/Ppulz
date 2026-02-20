-- Extend seed_requests status values and queue metadata.

do $$
begin
  if to_regclass('public.seed_requests') is null then
    return;
  end if;

  alter table public.seed_requests
    add column if not exists last_attempt_at timestamptz;

  update public.seed_requests
    set last_attempt_at = coalesce(last_attempt_at, requested_at, now())
    where last_attempt_at is null;

  if exists (
    select 1
    from pg_constraint
    where conname = 'seed_requests_status_check'
      and conrelid = 'public.seed_requests'::regclass
  ) then
    alter table public.seed_requests
      drop constraint seed_requests_status_check;
  end if;

  alter table public.seed_requests
    add constraint seed_requests_status_check
    check (status in ('pending', 'processing', 'done', 'failed', 'done_no_data'));
end;
$$;

create index if not exists idx_seed_requests_status_last_attempt
  on public.seed_requests (status, last_attempt_at desc);

