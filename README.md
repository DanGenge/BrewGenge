# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything).
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Signing in: a typed 6-digit code, not a clickable link

Enter your email, tick **Stay signed in on this device**, click **Send sign-in code**. BrewGenge emails a 6-digit code, type it in and click **Verify & sign in**. Nothing to click in the email.

### Why not a clickable magic link?

Corporate email security systems (Microsoft Defender Safe Links, Proofpoint, Mimecast etc.) automatically "visit" every link in an email to scan it for malware, before the user opens it. Since sign-in links are single-use, this silently consumes the token. By the time the real user clicks it, it's dead, bouncing back to login with no visible error. This is a documented Supabase issue (see `supabase/auth#1214` on GitHub, and Supabase's own troubleshooting docs on "otp_expired"). A typed code sitting as plain text can't be pre-fetched this way. **No Supabase settings or SQL changed for this, purely a front-end change** (uses `verifyOtp` instead of relying on `emailRedirectTo`).

### If the email itself doesn't arrive

1. Check spam first.
2. Confirm the Supabase project isn't paused (Supabase dashboard, free-tier projects auto-pause after about a week of inactivity, click Restore).
3. Wait 60 seconds between requests, the app enforces this automatically with a visible countdown.

## Why recipes/images weren't syncing before, and what changed

Sync previously could overwrite one side wholesale (an empty new device could wipe a populated cloud library). Now every sync fetches the cloud copy first, merges by recipe ID (keeping the most recently edited version), and combines favourites/pantry/ratings/brew history from both sides. An empty device can no longer erase a populated one.

## Sharing recipes (no account needed)

Recipe Library → Export Recipe Pack (all / favourites / mine), or the ⬇ icon on any recipe. Images are embedded as Base64 inside the JSON. Import JSON understands both BrewGenge's own format and common "verbose" recipe JSON.

## Do I need a "Community" feature?

No, not for sharing between mates, export/import already covers that. A "BrewGenge Community" feature (live discovery between different accounts) would need a new Supabase migration, not built yet.

## Features

Dashboard · Recipe Library · Recipe Detail popup (image, style comparison, live shopping list, star rating, brew history) · Equipment profiles · Create a Brew · Find a Brew · Fermentables · Hops (Tinseth IBU) · Water (mash/sparge temps + volumes, automatic salt calculator) · Brew Day · Fermentation log · Cost · Find Ingredients · Find a Supplier · Account & Sync (OTP code login, login gate, safe merge sync) · Read Me.
