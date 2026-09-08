-- ============================================================================
-- ADDITIVE MIGRATION: simple whole-state cloud sync
-- ============================================================================
-- Run this AFTER schema.sql. It does not touch or remove any existing table.
--
-- Why this exists: schema.sql defines a fully normalized structure (recipes,
-- ingredients, prices, suppliers, batches broken into proper relational
-- tables). That's the right long-term design, but wiring the front-end to
-- read/write every one of those tables individually is a much bigger job.
--
-- This table gives you real, working cloud sync right now: your entire
-- app state (My Recipes, custom prices, water settings, brew logs,
-- fermentation logs) is stored as a single JSON document per user, synced
-- automatically whenever you're signed in. You can migrate to the fully
-- normalized tables later without losing anything, this table is additive.
-- ============================================================================

create table if not exists public.user_app_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.user_app_state is 'Whole-app-state JSON sync per user. Mirrors the browser localStorage blob so it follows you across devices.';

alter table public.user_app_state enable row level security;

create policy "user_app_state_own" on public.user_app_state
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.fn_set_updated_at_state()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_app_state_updated on public.user_app_state;
create trigger trg_user_app_state_updated
  before update on public.user_app_state
  for each row execute function public.fn_set_updated_at_state();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
