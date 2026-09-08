# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything, don't leave old loose files from a previous upload sitting around).
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Adding your own logo

Drop a file at `img/logo.jpeg` (or `.jpg` / `.png`) — the app tries all three extensions automatically and falls back to a built-in drawn Celtic crest if none exist. **Filename must be lowercase** — GitHub Pages is case-sensitive, so `Logo.JPEG` will not match `logo.jpeg`.

## Supabase

Run `supabase/001_user_app_state.sql` once in the SQL Editor. Covers every account via Row Level Security — no further SQL needed, including for recipe packs.

## Sharing recipes

Recipe Library → **Export Recipe Pack** (all / favourites / mine) or the ⬇ icon on a single row. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common "verbose" recipe JSON (e.g. `fermentables`/`hops` as named objects with `amountKg`/`amountG`/`alphaAcidPercent`), which is what most AI-generated recipe searches produce. If a file has no readable ingredients, you get a clear error instead of a blank recipe.

## Changelog

- Fixed: Recipe Library actions column (Export ⬇ and Delete 🗑) was being clipped off-screen by an `overflow:hidden` container. The library table now has its own scrollable wrapper and a guaranteed-width actions column so all five icons (Brew, Rename/Image, Duplicate, Export, Delete) are always visible and clickable.
