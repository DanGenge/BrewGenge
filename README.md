# BrewGenge · Ultimate Brew Calculator

A static brew calculator with Supabase cloud sync. Built around the Guten 50L.

## Signing in

Email + password. That's it.

1. Enter your email and password
2. Tick **Stay signed in**
3. Tap **Login**

The session is restored automatically every time you open BrewGenge on that device, and your brews sync to the cloud on their own. Nothing is emailed, so nothing expires and nothing can be pre-clicked by a corporate mail scanner.

There is **no signup screen**. Accounts are created directly in Supabase.

### Creating a user

Supabase dashboard → **Authentication → Users → Add user**:
- Email + password
- Tick **Auto Confirm User**

That's the whole process. Repeat for anyone else who needs access — each account's brews stay completely private to that account.

### Supabase settings

**No SQL change.** `supabase/001_user_app_state.sql` is unchanged from every previous version. If you've run it before, don't run it again.

Authentication → **Sign In / Providers** → **Email**: provider **enabled**. Since accounts are made by hand with Auto Confirm ticked, the "Confirm email" toggle no longer matters either way.

No SMTP. No email templates. No confirmation emails.

> **No password reset.** Nothing is emailed, so there's no reset flow. If you forget a password, change it in Supabase → Authentication → Users → (user) → reset password. Your brews stay attached to the account.

## Dark mode

Toggle in the top-right of the header — **☽ moon** switches to dark, **☀ sun** switches back. Your choice is remembered on that device and survives page reloads.

## Logo

`img/logo.png` is the BrewGenge crest, shown large behind the login screen and as a subtle watermark behind the app. Its background has been made transparent so it sits correctly on both light and dark themes.

To swap it, replace `img/logo.png` (or add `img/logo.jpeg` / `img/logo.jpg`). Lowercase filenames — GitHub Pages is case-sensitive. A transparent PNG works best. If no file is found, a built-in drawn crest is used instead.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything).
2. **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Sync is merge-based, not overwrite-based

Every sync fetches the cloud copy first, merges by recipe ID (keeping whichever version was edited most recently), and unions favourites, pantry ticks, ratings and brew history from both sides before writing back. An empty device can never wipe a populated cloud library.

## Sharing recipes (no account needed)

Recipe Library → **Export Recipe Pack** (all / favourites / mine), or the ⬇ icon on any recipe. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common verbose recipe JSON.

## Features

Dashboard · Recipe Library · Recipe Detail popup (image, style comparison, live shopping list, star rating, brew history) · Equipment profiles · Create a Brew · Find a Brew · Fermentables · Hops (Tinseth IBU) · Water (mash/sparge temps + volumes, automatic salt calculator) · Brew Day · Fermentation log · Cost · Find Ingredients · Find a Supplier · Account & Sync · Read Me.

## Changelog

- **Login only.** Removed the signup screen, the Create Account tab, confirmation-email handling and all the auth explainer clutter. Just email, password, stay signed in, Login. Sign out lives under Account & Sync.
- **Dark mode toggle** in the header, persisted per device, applied across every tab, table, modal and the login screen.
- **Big BrewGenge crest** behind the login screen, plus a subtle watermark behind the app. Logo background made transparent so it works on light and dark.
- Safe merge sync, water/salt calculator, recipe detail popup — all unchanged.
