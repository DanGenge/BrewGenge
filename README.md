# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything, don't leave old loose files from a previous upload sitting around).
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Adding your own logo

Drop a file at `img/logo.jpeg` (or `.jpg` / `.png`) — the app tries all three extensions automatically and falls back to a built-in drawn Celtic crest if none exist. **Filename must be lowercase** — GitHub Pages is case-sensitive.

## Supabase

Run `supabase/001_user_app_state.sql` once in the SQL Editor. Covers every account via Row Level Security, no further SQL needed.

## Recipe detail popup

Click any recipe in the Recipe Library (or "View Recipe" on the Dashboard) to open a full detail popup:

- A large, clear image, click it to upload/change
- Live shopping list (fermentables + hops) with pantry checkboxes and running cost, so it's easy to see exactly what to buy
- A "typical style range" check for OG/FG/IBU/ABV
- A personal 1-5 star rating
- A brew history log, record actual OG/FG and notes each time you brew it
- **Brew This** (switches your active recipe), **Share** (native share sheet or clipboard fallback), **Export** (JSON with image embedded), **Duplicate**, **Edit ingredients**, and **Delete/Hide**

Honest limitation: there's no backend server here, so "Share" can't create a public link or a QR code, it uses your device's native share sheet where supported, or copies a text summary to your clipboard. For an exact copy (including photos), use Export and send the JSON file directly.

## Sharing recipes

Recipe Library → **Export Recipe Pack** (all / favourites / mine), or the Export button inside a recipe's popup for just one. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common "verbose" recipe JSON (e.g. `fermentables`/`hops` as named objects with `amountKg`/`amountG`/`alphaAcidPercent`), which is what most AI-generated recipe searches produce.
