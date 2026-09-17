# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything, don't leave old loose files from a previous upload sitting around).
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Adding your own logo

Drop a file at `img/logo.jpeg` (or `.jpg` / `.png`) — the app tries all three extensions automatically and falls back to a built-in drawn Celtic crest if none exist. **Filename must be lowercase** — GitHub Pages is case-sensitive.

## Signing in (magic link email) — no SQL required, this is a Dashboard setting

Run `supabase/001_user_app_state.sql` once, that's the only SQL BrewGenge needs, ever, for the current feature set (recipes, ratings, brew history, images, packs, sign-in/sync).

**If the magic link email never arrives, or the link errors when clicked, it is almost always one of these Supabase Dashboard settings, not something in the code or the database:**

1. **Redirect URL allow-list** — Supabase project → **Authentication → URL Configuration → Redirect URLs**. Add your exact GitHub Pages URL here (the Account & Sync tab in the app shows you the exact string to copy). If it's missing from this list, Supabase either silently drops the request or bounces the link to an error page.
2. **Site URL** — same settings screen, set it to your GitHub Pages URL, not the Supabase default `localhost` placeholder.
3. **Spam folder** — check it first, always.
4. **Rate limits** — Supabase's free tier allows roughly one OTP email per address every 60 seconds, and a small hourly cap project-wide. The app now enforces a 60 second cooldown on the "Send magic link" button and disables it during that window so you can't accidentally trigger the rate limit yourself.

The app also now reads any `#error=...` parameters Supabase attaches to the URL after a bad/expired link click and displays the actual reason on the Account & Sync tab, rather than failing silently.

## Sharing recipes

Recipe Library → **Export Recipe Pack** (all / favourites / mine) or the ⬇ icon on a single row, or the same icon inside the recipe detail popup. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common "verbose" recipe JSON. Sharing this way needs no account and no sign-in at all.

## "Do I need a Community feature?"

No, not for sharing. Export/Import already lets you send a recipe (with photo) to a mate, and each of you keeps completely separate accounts and data if you both sign in. A "BrewGenge Community" feature would only be needed for **live, in-app discovery and sharing between different accounts** (browsing other people's public recipes without a file being manually sent) — that's a genuinely different feature, and would need a new Supabase migration for cross-account visibility rules. Not built yet, flag it if you want it.

## Changelog

- Recipe Library actions column (Export/Delete icons) fixed, was previously clipped by an `overflow:hidden` container.
- Added the full Recipe Detail popup: large image (click to change), style-range comparison, colour estimate, live batch/equipment recalculation, shopping list with pantry checkboxes, 1-5 star rating, brew history log (actual OG/FG/notes per brew), Brew/Favourite/Share/Export/Duplicate/Edit/Delete all in one place.
- Hardened the magic-link sign-in flow: validates email format client-side, enforces and displays a 60s resend cooldown (button disables and shows a countdown), surfaces real Supabase error messages instead of failing silently, parses and displays `#error=...` redirect errors with plain-English advice, cleans stray auth tokens out of the URL bar after sign-in, and pressing Enter in the email field now submits.
- **Water tab overhaul**: strike water, sparge water and total water are now genuinely calculated in litres (previously the Water tab only ever showed ion ppm targets, with no volumes at all). Added an automatic salt addition calculator (Gypsum, Calcium Chloride, Epsom Salt, Baking Soda, and 88% Lactic Acid where alkalinity needs reducing) computed from the gap between your source water and each recipe's target profile, scaled to the batch's actual total liquor volume, recalculating live whenever you change recipe, batch size, equipment or the source water figures. The same water/salt numbers now also appear as quick-glance stats on the Brew Day tab.
