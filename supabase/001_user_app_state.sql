-- ============================================================================
-- BrewGenge cloud sync table. Run once in the Supabase SQL editor.
-- Safe to re-run. This is ALL the SQL required for the current app.
-- ============================================================================

create table if not exists public.user_app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_app_state' and policyname='user_app_state_own'
  ) then
    create policy user_app_state_own on public.user_app_state
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

create or replace function public.fn_touch_user_app_state()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_touch_user_app_state on public.user_app_state;
create trigger trg_touch_user_app_state
  before update on public.user_app_state
  for each row execute function public.fn_touch_user_app_state();
