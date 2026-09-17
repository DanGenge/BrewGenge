# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything, don't leave old loose files from a previous upload sitting around).
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Adding your own logo

Drop a file at `img/logo.jpeg` (or `.jpg` / `.png`) — the app tries all three extensions automatically and falls back to a built-in drawn Celtic crest if none exist. **Filename must be lowercase** — GitHub Pages is case-sensitive.

## Signing in (magic link email) — no SQL required, this is a Dashboard/project setting

Run `supabase/001_user_app_state.sql` once, that's the only SQL BrewGenge needs, ever, for the current feature set (recipes, ratings, brew history, images, packs, sign-in/sync).

**If clicking "Send magic link" shows an immediate error like "Load failed" or "Failed to fetch" (not a delayed rate-limit message):** the request never reached Supabase at all. Check, in order:

1. **Is the Supabase project paused?** Free-tier projects pause automatically after about a week of no activity. Log into supabase.com, open the project, and look for a "Restore project" button. This is by far the most common cause, and explains identical failures across completely different browsers/devices (PC Edge and iPhone Safari both failing the same way is the signature of this, not a browser-specific bug).
2. **Project URL and API key still match** — Settings → API in the Supabase dashboard.
3. **Try a different network** — some corporate/school Wi-Fi blocks third-party API domains outright.

**Once requests are reaching Supabase but the email itself never arrives:**

1. **Spam / Junk folder** first, always.
2. **Redirect URL allow-list** — Supabase project → **Authentication → URL Configuration → Redirect URLs**. Add your exact GitHub Pages URL here (the Account & Sync tab in the app shows you the exact string to copy).
3. **Site URL** — same settings screen, set it to your GitHub Pages URL, not the Supabase default `localhost` placeholder.
4. **Rate limits** — Supabase's free tier allows roughly one OTP email per address every 60 seconds, and a small hourly cap project-wide. The app enforces and displays a 60 second cooldown on the "Send magic link" button so you can't accidentally trigger the rate limit yourself.

The app also reads any `#error=...` parameters Supabase attaches to the URL after a bad/expired link click and displays the actual reason on the Account & Sync tab, rather than failing silently.

## Water and salt additions

The Water tab now calculates real litres, not just ion ppm targets: strike water volume and temperature, mash tun volume, sparge water volume, and total water needed, all recalculated live from the selected recipe, batch size, equipment and mash/sparge settings. It then suggests exact gram amounts of Gypsum, Calcium Chloride, Epsom Salt, Baking Soda, and mL of 88% Lactic Acid, based on the gap between your source water and the recipe's target water profile.

Custom recipes (via Create a Brew) and imported recipes without their own water profile automatically get a sensible **style-aware** water target (matched by keyword against the style text, e.g. IPA gets a sulphate-forward profile, Stout gets higher alkalinity) rather than defaulting to a copy of the source water, which would make every salt suggestion show 0.0g.

## Sharing recipes

Recipe Library → **Export Recipe Pack** (all / favourites / mine) or the ⬇ icon on a single row, or the same icon inside the recipe detail popup. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common "verbose" recipe JSON (e.g. `fermentables`/`hops` as named objects with `amountKg`/`amountG`/`alphaAcidPercent`, and water as `sulfate`/`alkalinity` style long-form keys), which is what most AI-generated recipe searches produce. If a file has no readable ingredients, you get a clear error instead of a blank recipe.

## "Do I need a Community feature?"

No, not for sharing. Export/Import already lets you send a recipe (with photo) to a mate, and each of you keeps completely separate accounts and data if you both sign in. A "BrewGenge Community" feature would only be needed for **live, in-app discovery and sharing between different accounts** — that's a genuinely different feature, and would need a new Supabase migration for cross-account visibility rules.
