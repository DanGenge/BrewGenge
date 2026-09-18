# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L.

## Sign-in: email + password

Tap **Create account**, enter your email, pick a password (6+ characters), confirm it. After that, **Sign in** on any device. Tick **Stay signed in on this device** (on by default) and you won't be asked again on that device.

No magic links. No emailed codes. Nothing to click, nothing that expires, nothing that can be pre-opened by a mail scanner.

### Why the switch

Magic links kept failing on `@orica.com` because corporate mail security (Microsoft Defender Safe Links and equivalents) automatically opens every link in inbound mail to scan it. Sign-in links are single-use, so the scan burned the link before it was ever clicked, producing an "expired/invalid" bounce straight back to the login screen with no visible error.

The emailed-6-digit-code approach would also have worked, but printing the code requires editing the Supabase **Magic Link email template**, and template editing is locked behind custom SMTP on the free tier. So the code never appeared in the email and the app sat waiting for a number that was never sent.

Password auth avoids both problems entirely: nothing is emailed at all.

## Supabase setup

**No SQL change.** `supabase/001_user_app_state.sql` is identical to previous versions. If you've already run it, don't run it again.

**One dashboard setting:**

Authentication → **Sign In / Providers** → **Email**
- Email provider: **enabled**
- **"Confirm email": OFF**

If "Confirm email" is left ON, Supabase emails a confirmation *link* when you create an account, and you're back to the original problem. With it off, Create account signs you straight in. BrewGenge detects this case and tells you plainly rather than appearing to hang.

No SMTP, no email templates, nothing else.

### No password reset

Since nothing is emailed, there's no password reset flow. If you forget it, delete the user under Supabase → Authentication → Users and create the account again. Export a Recipe Pack first as a backup if you do.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything).
2. **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Adding your own logo

Drop a file at `img/logo.jpeg` (or `.jpg` / `.png`). Lowercase filename, GitHub Pages is case-sensitive. Falls back to a built-in drawn crest if absent.

## Sync is merge-based, not overwrite-based

Every sync fetches the cloud copy first, merges by recipe ID (keeping whichever version was edited most recently), and unions favourites, pantry ticks, ratings and brew history from both sides before writing back. An empty device can never wipe a populated cloud library.

## Sharing recipes (no account needed)

Recipe Library → **Export Recipe Pack** (all / favourites / mine), or the ⬇ icon on any recipe. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common verbose recipe JSON.

## Features

Dashboard · Recipe Library · Recipe Detail popup (image, style comparison, live shopping list, star rating, brew history) · Equipment profiles · Create a Brew · Find a Brew · Fermentables · Hops (Tinseth IBU) · Water (mash/sparge temps + volumes, automatic salt calculator) · Brew Day · Fermentation log · Cost · Find Ingredients · Find a Supplier · Account & Sync · Read Me.

## Changelog

- **Email + password sign-in** replaces the emailed-code flow, which replaced magic links. Nothing is emailed during sign-in at all. Sign in / Create account tabs, password confirmation on signup, plain-English error messages, and an explicit warning if Supabase's "Confirm email" setting is still on.
- Safe merge sync: recipes, images, favourites, pantry, ratings and brew history combined by most-recently-edited rather than overwritten in either direction.
- Water tab: strike/sparge temperatures and volumes, automatic salt addition calculator, style-aware water targets for new/imported recipes.
- Recipe Detail popup with image, style-range comparison, colour estimate, live shopping list, star rating and brew history log.
