# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything, don't leave old loose files from a previous upload sitting around).
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Adding your own logo

Drop a file at `img/logo.jpeg` (or `.jpg` / `.png`) — the app tries all three extensions automatically and falls back to a built-in drawn Celtic crest if none exist. **Filename must be lowercase.**

## Signing in — new login cover page + safe cloud sync

Opening BrewGenge on a device that isn't already signed in now shows a login screen: enter your email, tick **Stay signed in on this device** (on by default), click **Send secure sign-in link**, or click **Continue offline** to skip it entirely (BrewGenge works fully offline, forever, if you prefer).

Click the emailed link on the **same device** you requested it from. After that, Supabase keeps the session persisted, so this really is a one-off per device as long as "Stay signed in" stays ticked. Unticking it signs you out automatically whenever the tab is closed or backgrounded, useful on a shared computer.

Run `supabase/001_user_app_state.sql` once, that's the only SQL BrewGenge needs. No schema changes were required for this upgrade.

### If sign-in fails identically on every device/browser

1. **Paused Supabase project** — free-tier projects auto-pause after about a week of inactivity. Log into supabase.com, open the project, click **Restore** if it says Paused, wait a couple of minutes.
2. **Site URL / Redirect URL mismatch** — Supabase → **Authentication → URL Configuration**. Both **Site URL** and **Redirect URLs** must be your real live GitHub Pages URL, not `localhost`. The Account & Sync tab shows you the exact string to paste in. A mismatch here is what causes "invalid or expired" errors even on a freshly clicked link.
3. **Rate limits** — roughly one email per address every 60 seconds. The app enforces a matching cooldown so you can't trigger this yourself.

## Why recipes/images weren't syncing before, and what changed

Previously, signing in on a second device would **overwrite** whichever side (local or cloud) was older, in either direction — so an empty new phone could wipe a populated cloud library, or vice versa. Every sync operation now:

1. Fetches the current cloud copy first
2. **Merges** it with the local copy by matching recipe IDs, keeping whichever version of each recipe was edited most recently
3. Combines favourites, pantry ticks, ratings and brew history from both sides rather than replacing one with the other
4. Only then writes the merged result back to the cloud

An empty device can no longer erase a populated cloud library, and vice versa. The very first device to ever sign in uploads its library; every later device merges instead of overwriting.

## Sharing recipes (no account needed)

Recipe Library → **Export Recipe Pack** (all / favourites / mine) or the ⬇ icon on any recipe. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common "verbose" recipe JSON.

## Do I need a "Community" feature?

No, not for sharing between mates, export/import already covers that and each account stays completely separate. A "BrewGenge Community" feature (live discovery/sharing between different accounts) would need a new Supabase migration, this isn't built yet.

## Features

Dashboard · Recipe Library · Recipe Detail popup (image, style comparison, live shopping list, star rating, brew history) · Equipment profiles · Create a Brew · Find a Brew · Fermentables · Hops (Tinseth IBU) · Water (mash/sparge temps + volumes, automatic salt calculator) · Brew Day · Fermentation log · Cost · Find Ingredients · Find a Supplier · Account & Sync with login gate and safe merge sync · Read Me.

## Changelog

- **Login cover page**: shown on any device not already signed in, with a "Stay signed in" checkbox (default on) and a "Continue offline" option that permanently skips it until you choose to sign in from the Account & Sync tab.
- **Safe merge sync** (the fix for "my recipes/images aren't syncing"): sync no longer blindly overwrites in either direction. It reads the cloud copy, merges by recipe ID keeping the most recently edited version, unions favourites/pantry/ratings/brew history, and writes the merged result back. First-ever sign-in uploads local data; an empty device merging with a populated cloud restores everything automatically.
- Water tab: strike/sparge temperatures and volumes, automatic salt addition calculator (Gypsum, Calcium Chloride, Epsom Salt, Baking Soda, Lactic Acid), fixed so new/imported recipes get a real style-appropriate water target instead of a copy of the source water (previously caused every salt suggestion to show 0.0g).
- Recipe Detail popup: image, style-range comparison, colour estimate, live shopping list, 1-5 star rating, brew history log.
- Recipe Library action icons (Export/Delete) fixed, previously clipped off-screen.
- Hardened login errors: real Supabase error messages, resend cooldown with visible countdown, `#error=...` redirect errors parsed and explained, dynamic SDK loading so a paused project never hangs the rest of the app.
