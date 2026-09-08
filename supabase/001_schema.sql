-- ============================================================================
-- ULTIMATE BREW CALCULATOR — SUPABASE / POSTGRES SCHEMA
-- ============================================================================
-- Covers the four pillars requested: Recipes, Prices, Suppliers, Brew Logs.
-- Plus supporting tables for Create a Brew, Find a Brew, and Find a Supplier.
--
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query),
-- BEFORE running 002_app_state_sync.sql.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fuzzy text search on ingredient/recipe names


-- ============================================================================
-- 1. PROFILES
--    One row per authenticated user, extends Supabase auth.users.
-- ============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_location text,                       -- e.g. "Richmond Vale, NSW", used for supplier distance context
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Extends auth.users with app-specific profile fields.';


-- ============================================================================
-- 2. INGREDIENTS  (master catalog — the "single source of truth" for names)
--    Recipes and prices both reference ingredient_id, never a free-text name.
--    This is what makes Find a Supplier a real join instead of a guess.
-- ============================================================================
create table if not exists public.ingredients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  category         text not null check (category in ('fermentable','hop','yeast','salt','spice','misc')),
  default_unit     text not null check (default_unit in ('kg','g','mL','each','pack')),
  extract_potential numeric,                -- L°/kg, fermentables only
  alpha_acid_pct   numeric,                 -- typical/default AA%, hops only (recipe can override per batch)
  is_verified      boolean not null default false, -- true once a human has confirmed this maps to a real product
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_ingredients_category on public.ingredients(category);
create index if not exists idx_ingredients_name_trgm on public.ingredients using gin (name gin_trgm_ops);

comment on table public.ingredients is 'Master catalog of every fermentable, hop, yeast, salt and spice used across all recipes.';


-- ============================================================================
-- 3. SUPPLIERS  (Find a Supplier)
-- ============================================================================
create table if not exists public.suppliers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null unique,
  url                    text,
  location               text,
  delivery_type          text not null check (delivery_type in ('flat','flat_free_over','local_flat_free_over','pickup_only')),
  delivery_cost          numeric not null default 0,
  delivery_free_over     numeric,           -- null = never free
  delivery_notes         text,
  is_delivery_confirmed  boolean not null default false,  -- true once verified against the supplier's own shipping page
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.suppliers is 'Australian homebrew suppliers with their delivery terms, manually researched and refreshed periodically.';


-- ============================================================================
-- 4. INGREDIENT PRICES  (per supplier, per ingredient — supports price history)
-- ============================================================================
create table if not exists public.ingredient_prices (
  id                   uuid primary key default gen_random_uuid(),
  supplier_id          uuid not null references public.suppliers(id) on delete cascade,
  ingredient_id        uuid not null references public.ingredients(id) on delete cascade,
  price                numeric not null check (price >= 0),
  unit                 text not null check (unit in ('kg','g','mL','each','pack')),
  is_price_confirmed   boolean not null default false,   -- true = verified directly on the supplier site
  source_note          text,                              -- e.g. "Brewman: Simcoe USA (T90)" or "estimated, not stocked"
  price_date           date not null default current_date, -- snapshot date, allows keeping history rather than overwriting
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now()
);

create index if not exists idx_ingredient_prices_lookup on public.ingredient_prices(supplier_id, ingredient_id, price_date desc);

comment on table public.ingredient_prices is 'Price snapshots per supplier per ingredient. Multiple rows per pair are kept over time; use v_current_prices for the latest.';

-- Convenience view: only the most recent price per supplier+ingredient pair
create or replace view public.v_current_prices as
select distinct on (supplier_id, ingredient_id)
  ip.id, ip.supplier_id, ip.ingredient_id, ip.price, ip.unit,
  ip.is_price_confirmed, ip.source_note, ip.price_date
from public.ingredient_prices ip
order by supplier_id, ingredient_id, price_date desc, created_at desc;


-- ============================================================================
-- 5. WATER PROFILES  (reusable source water definitions, e.g. Floraville/Hunter Water)
-- ============================================================================
create table if not exists public.water_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,  -- null = shared/system default
  name         text not null,
  location     text,
  calcium_ppm     numeric not null default 0,
  magnesium_ppm   numeric not null default 0,
  sodium_ppm      numeric not null default 0,
  sulphate_ppm    numeric not null default 0,
  chloride_ppm    numeric not null default 0,
  alkalinity_ppm  numeric not null default 0,
  source_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.water_profiles is 'Reusable source water definitions, e.g. "Floraville / Hunter Water (Grahamstown-Tomago)".';


-- ============================================================================
-- 6. RECIPES  (the template — Create a Brew / Recipe Library / Find a Brew all write here)
-- ============================================================================
create table if not exists public.recipes (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete cascade,
  name               text not null,
  style              text,
  base_batch_l       numeric not null check (base_batch_l > 0),

  target_og          numeric,
  target_fg          numeric,
  target_abv         numeric,
  target_ibu         numeric,

  yeast_name         text,
  yeast_form         text check (yeast_form in ('Dry','Liquid')),
  attenuation_pct    numeric,
  ferment_temp_lo    numeric,
  ferment_temp_hi    numeric,

  description        text,
  water_profile_id   uuid references public.water_profiles(id),

  -- water ion targets specific to this recipe/style (kept as columns since the ion set is fixed and small)
  target_calcium_ppm    numeric,
  target_magnesium_ppm  numeric,
  target_sodium_ppm     numeric,
  target_sulphate_ppm   numeric,
  target_chloride_ppm   numeric,
  target_alkalinity_ppm numeric,

  source             text not null default 'user-created' check (source in ('built-in','user-created','ai-generated','imported')),
  is_public          boolean not null default false,   -- true = visible to other users (community library)

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_recipes_user on public.recipes(user_id);
create index if not exists idx_recipes_public on public.recipes(is_public) where is_public = true;
create index if not exists idx_recipes_name_trgm on public.recipes using gin (name gin_trgm_ops);

comment on table public.recipes is 'Recipe templates at a base batch size. Actual brews are tracked separately in batches.';


-- ============================================================================
-- 7. RECIPE FERMENTABLES  (grain bill line items, at base_batch_l)
-- ============================================================================
create table if not exists public.recipe_fermentables (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references public.recipes(id) on delete cascade,
  ingredient_id     uuid not null references public.ingredients(id),
  amount_kg         numeric not null check (amount_kg >= 0),
  extract_potential numeric,           -- override of ingredients.extract_potential for this recipe, if needed
  notes             text,
  sort_order        int not null default 0
);

create index if not exists idx_recipe_ferm_recipe on public.recipe_fermentables(recipe_id);


-- ============================================================================
-- 8. RECIPE HOPS  (hop schedule line items, at base_batch_l)
-- ============================================================================
create table if not exists public.recipe_hops (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  ingredient_id  uuid not null references public.ingredients(id),
  amount_g       numeric not null check (amount_g >= 0),
  alpha_acid_pct numeric not null check (alpha_acid_pct >= 0),
  stage          text not null check (stage in ('Boil','Whirlpool','Dry Hop')),
  time_min       numeric not null default 0,
  dry_hop_day    text,               -- e.g. "Day 4", free text since some brewers use "D4" or a date
  sort_order     int not null default 0
);

create index if not exists idx_recipe_hops_recipe on public.recipe_hops(recipe_id);


-- ============================================================================
-- 9. AI RECIPE IMPORTS  (Find a Brew — search/import history and audit trail)
-- ============================================================================
create table if not exists public.ai_recipe_imports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade,
  query_text       text not null,          -- what the user searched, e.g. "HenHouse Incredible IPA"
  raw_response     text,                    -- the raw AI/search response, kept for audit/reproducibility
  parsed_recipe_id uuid references public.recipes(id) on delete set null,  -- null if not saved, or if since deleted
  parse_method     text check (parse_method in ('structured_json','freeform_text','quick_generate')),
  created_at       timestamptz not null default now()
);

comment on table public.ai_recipe_imports is 'History of Find a Brew searches/imports, whether or not the result was ultimately saved as a recipe.';


-- ============================================================================
-- 10. BATCHES  (an actual instance of brewing a recipe — this is the brew log root)
-- ============================================================================
create table if not exists public.batches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  recipe_id      uuid references public.recipes(id) on delete set null,
  batch_name     text not null,             -- e.g. "Batch #14 — Incredible IPA"
  batch_size_l   numeric not null check (batch_size_l > 0),
  brew_date      date,
  status         text not null default 'planned' check (status in ('planned','brewing','fermenting','conditioning','packaged','archived')),

  -- process assumptions captured at time of brew (so later edits to defaults don't rewrite history)
  efficiency_pct           numeric,
  boil_min                 numeric,
  boil_off_l_per_hr        numeric,
  kettle_loss_l            numeric,
  grain_absorption_l_per_kg numeric,
  mash_thickness_l_per_kg  numeric,
  whirlpool_util_factor    numeric,

  measured_mash_ph  numeric,
  target_mash_ph    numeric,
  cold_crash_temp   numeric,
  carbonation_target_vol numeric,

  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_batches_user on public.batches(user_id);
create index if not exists idx_batches_recipe on public.batches(recipe_id);
create index if not exists idx_batches_status on public.batches(status);

comment on table public.batches is 'One row per actual brew day. Links back to the recipe template it was scaled from.';


-- ============================================================================
-- 11. BATCH SALT ADDITIONS  (manual per-batch, since salts never auto-scale)
-- ============================================================================
create table if not exists public.batch_salt_additions (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.batches(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),   -- link to a 'salt' category ingredient, e.g. Gypsum
  salt_name     text not null,                             -- denormalized fallback label, in case ingredient_id is null
  amount_g      numeric not null default 0
);

create index if not exists idx_batch_salts_batch on public.batch_salt_additions(batch_id);


-- ============================================================================
-- 12. BATCH BREW DAY LOG  (single row per batch — actual measurements vs target)
-- ============================================================================
create table if not exists public.batch_brewday_log (
  id                        uuid primary key default gen_random_uuid(),
  batch_id                  uuid not null unique references public.batches(id) on delete cascade,
  preboil_vol_actual_l      numeric,
  preboil_gravity_actual    numeric,
  postboil_vol_actual_l     numeric,
  og_actual                 numeric,
  fermenter_vol_actual_l    numeric,
  mash_ph_actual            numeric,
  brew_day_notes            text,
  updated_at                timestamptz not null default now()
);

comment on table public.batch_brewday_log is 'Actual vs target brew-day measurements. One row per batch.';


-- ============================================================================
-- 13. BATCH FERMENTATION LOGS  (many rows per batch — day-by-day readings)
-- ============================================================================
create table if not exists public.batch_fermentation_logs (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches(id) on delete cascade,
  log_day      int not null,             -- days since pitch
  log_date     date,
  gravity      numeric,
  temperature_c numeric,
  notes        text,
  created_at   timestamptz not null default now(),
  unique(batch_id, log_day)
);

create index if not exists idx_ferm_logs_batch on public.batch_fermentation_logs(batch_id, log_day);

comment on table public.batch_fermentation_logs is 'Day-by-day fermentation readings, one row per day per batch.';


-- ============================================================================
-- 14. BATCH CHECKLIST ITEMS  (the brew-day process checklist, persisted per batch)
-- ============================================================================
create table if not exists public.batch_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.batches(id) on delete cascade,
  step_order  int not null default 0,
  step_text   text not null,
  is_done     boolean not null default false
);

create index if not exists idx_checklist_batch on public.batch_checklist_items(batch_id);


-- ============================================================================
-- 15. UPDATED_AT TRIGGER  (auto-maintain updated_at on every UPDATE)
-- ============================================================================
create or replace function public.fn_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','ingredients','suppliers','water_profiles',
    'recipes','batches','batch_brewday_log'
  ]
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I; ' ||
      'create trigger trg_set_updated_at before update on public.%I ' ||
      'for each row execute function public.fn_set_updated_at();',
      t, t
    );
  end loop;
end $$;


-- ============================================================================
-- 16. VIEW: full recipe as one row per ingredient line, ready for the app to hydrate
-- ============================================================================
create or replace view public.v_recipe_fermentables_full as
select
  rf.recipe_id, rf.id as line_id, i.name as ingredient_name, i.category,
  rf.amount_kg, coalesce(rf.extract_potential, i.extract_potential) as extract_potential,
  rf.notes, rf.sort_order
from public.recipe_fermentables rf
join public.ingredients i on i.id = rf.ingredient_id
order by rf.recipe_id, rf.sort_order;

create or replace view public.v_recipe_hops_full as
select
  rh.recipe_id, rh.id as line_id, i.name as ingredient_name,
  rh.amount_g, rh.alpha_acid_pct, rh.stage, rh.time_min, rh.dry_hop_day, rh.sort_order
from public.recipe_hops rh
join public.ingredients i on i.id = rh.ingredient_id
order by rh.recipe_id, rh.sort_order;


-- ============================================================================
-- 17. FUNCTION: landed cost per supplier for a given batch (Find a Supplier, for real)
-- ============================================================================
create or replace function public.fn_batch_landed_cost(p_batch_id uuid)
returns table (
  supplier_id uuid,
  supplier_name text,
  ingredient_subtotal numeric,
  delivery_cost numeric,
  landed_total numeric,
  priced_line_count int,
  missing_line_count int
)
language sql
stable
as $$
  with b as (
    select id, recipe_id, batch_size_l from public.batches where id = p_batch_id
  ),
  scale as (
    select b.id as batch_id, b.batch_size_l / r.base_batch_l as factor, r.id as recipe_id
    from b join public.recipes r on r.id = b.recipe_id
  ),
  ferm_lines as (
    select s.batch_id, rf.ingredient_id, rf.amount_kg * s.factor as amount, 'kg'::text as unit
    from public.recipe_fermentables rf
    join scale s on s.recipe_id = rf.recipe_id
  ),
  hop_lines as (
    select s.batch_id, rh.ingredient_id, rh.amount_g * s.factor as amount, 'g'::text as unit
    from public.recipe_hops rh
    join scale s on s.recipe_id = rh.recipe_id
  ),
  all_lines as (
    select * from ferm_lines
    union all
    select * from hop_lines
  ),
  priced as (
    select
      sup.id as supplier_id, sup.name as supplier_name,
      sup.delivery_type, sup.delivery_cost, sup.delivery_free_over,
      al.ingredient_id, al.amount, cp.price, cp.unit as price_unit,
      (al.amount * cp.price) as line_cost
    from all_lines al
    cross join public.suppliers sup
    left join public.v_current_prices cp
      on cp.supplier_id = sup.id and cp.ingredient_id = al.ingredient_id
    where sup.is_active = true
  )
  select
    supplier_id, supplier_name,
    coalesce(sum(line_cost) filter (where line_cost is not null), 0) as ingredient_subtotal,
    case
      when max(delivery_type) = 'flat' then max(delivery_cost)
      when max(delivery_type) in ('flat_free_over','local_flat_free_over')
        then case when coalesce(sum(line_cost) filter (where line_cost is not null),0) >= max(delivery_free_over)
                   then 0 else max(delivery_cost) end
      else 0
    end as delivery_cost,
    coalesce(sum(line_cost) filter (where line_cost is not null), 0)
      + case
          when max(delivery_type) = 'flat' then max(delivery_cost)
          when max(delivery_type) in ('flat_free_over','local_flat_free_over')
            then case when coalesce(sum(line_cost) filter (where line_cost is not null),0) >= max(delivery_free_over)
                       then 0 else max(delivery_cost) end
          else 0
        end as landed_total,
    count(*) filter (where line_cost is not null)::int as priced_line_count,
    count(*) filter (where line_cost is null)::int as missing_line_count
  from priced
  group by supplier_id, supplier_name
  order by landed_total asc;
$$;

comment on function public.fn_batch_landed_cost is 'Ranks active suppliers by estimated landed cost (ingredients + delivery) for a given batch, using the latest confirmed/estimated prices on file.';


-- ============================================================================
-- 18. ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.suppliers enable row level security;
alter table public.ingredient_prices enable row level security;
alter table public.water_profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_fermentables enable row level security;
alter table public.recipe_hops enable row level security;
alter table public.ai_recipe_imports enable row level security;
alter table public.batches enable row level security;
alter table public.batch_salt_additions enable row level security;
alter table public.batch_brewday_log enable row level security;
alter table public.batch_fermentation_logs enable row level security;
alter table public.batch_checklist_items enable row level security;

-- profiles: users manage only their own profile
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- ingredients: readable by anyone signed in; any signed-in user can add a new ingredient
create policy "ingredients_select_all" on public.ingredients for select using (auth.role() = 'authenticated');
create policy "ingredients_insert_authenticated" on public.ingredients for insert with check (auth.role() = 'authenticated');
create policy "ingredients_update_authenticated" on public.ingredients for update using (auth.role() = 'authenticated');

-- suppliers & prices: shared reference data, readable by anyone signed in
create policy "suppliers_select_all" on public.suppliers for select using (auth.role() = 'authenticated');
create policy "suppliers_write_authenticated" on public.suppliers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "prices_select_all" on public.ingredient_prices for select using (auth.role() = 'authenticated');
create policy "prices_write_authenticated" on public.ingredient_prices for insert with check (auth.role() = 'authenticated');

-- water profiles: user's own, or shared (user_id is null)
create policy "water_select_own_or_shared" on public.water_profiles for select using (user_id is null or user_id = auth.uid());
create policy "water_write_own" on public.water_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- recipes: owner has full access; anyone signed in can read public recipes
create policy "recipes_select_own_or_public" on public.recipes for select using (user_id = auth.uid() or is_public = true);
create policy "recipes_write_own" on public.recipes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- recipe line items: follow the parent recipe's visibility
create policy "recipe_ferm_select" on public.recipe_fermentables for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and (r.user_id = auth.uid() or r.is_public = true))
);
create policy "recipe_ferm_write" on public.recipe_fermentables for all using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);

create policy "recipe_hops_select" on public.recipe_hops for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and (r.user_id = auth.uid() or r.is_public = true))
);
create policy "recipe_hops_write" on public.recipe_hops for all using (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
);

-- ai_recipe_imports: strictly private to the user who ran the search
create policy "ai_imports_own" on public.ai_recipe_imports for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- batches and all brew-log children: strictly private to the owning user
create policy "batches_own" on public.batches for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "batch_salts_own" on public.batch_salt_additions for all using (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
);

create policy "batch_brewday_own" on public.batch_brewday_log for all using (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
);

create policy "batch_ferm_logs_own" on public.batch_fermentation_logs for all using (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
);

create policy "batch_checklist_own" on public.batch_checklist_items for all using (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())
);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
