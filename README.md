# BrewGenge · Ultimate Brew Calculator

A static brew calculator with Supabase cloud sync. Built around the Guten 50L.

## Signing in

BrewGenge opens on its own **login page** — brand bar, hero panel, and a clean auth card. Nothing else loads until you're in.

**First time?** Tap **Create account**, enter an email and a password (6+ characters), confirm it, and you're straight in. Nothing is emailed, nothing to click, nothing to wait for.

**After that** just **Sign in** on any device with the same details.

**Stay signed in on this device** is ticked by default, so the session restores automatically every time you open BrewGenge there and your brews sync on their own.

**Continue without an account** is there too — the whole app works, just saved in that browser only.

The same Sign in / Create account form also lives under **Account & Sync** if you'd rather switch accounts from inside the app.

### Supabase settings

**No SQL change.** `supabase/001_user_app_state.sql` is unchanged from every previous version. If you've run it before, don't run it again.

Authentication → **Sign In / Providers** → **Email**:
- Email provider: **enabled**
- **"Confirm email": OFF**

That second one matters. Left ON, Supabase emails a confirmation *link* on signup and you're back in link-hell. With it off, Create account signs you straight in. BrewGenge detects this case and names the exact toggle rather than appearing to hang.

No SMTP. No email templates.

> **No password reset.** Nothing is emailed, so there's no reset flow. If you forget a password, change it in Supabase → Authentication → Users → (user) → reset password. Your brews stay attached to the account.

## Share BrewGenge

The **Share BrewGenge** tab writes an invite for you. Enter their name, their email, and your name, and it composes the whole message with the link in it.

**Why it opens your email app instead of sending directly:** BrewGenge is a static site with no server behind it, so it physically cannot send email itself. Instead the invite opens in whatever mail app you already use, pre-addressed and pre-written, ready to hit send. That's actually better — it arrives from your real address, so it won't get spam-filtered the way a no-reply from an unfamiliar domain would.

Three ways to send:
- **Open in my email app** — pre-fills a new email, you just hit send
- **Copy invite** — full message on the clipboard, paste anywhere (text, WhatsApp, wherever)
- **Copy link only** — just the URL

On phones there's also a **Share…** button that uses the native share sheet.

A live preview shows exactly what they'll receive, updating as you type. Everyone you share with gets logged to a **Shared with** list so you can keep track, and that list syncs across your devices like everything else.

Whoever you send it to can use the entire app without an account. If you want their recipes synced too, add them under Supabase → Authentication → Users and give them the login.

## Dark mode

Toggle in the top-right of the header — **☽ moon** switches to dark, **☀ sun** switches back. Remembered on that device and survives reloads.

## Logo

`img/logo.png` is the BrewGenge crest, shown large behind the login screen and as a subtle watermark behind the app. Its background has been made transparent so it sits correctly on both themes.

To swap it, replace `img/logo.png` (or add `img/logo.jpeg` / `img/logo.jpg`). Lowercase filenames — GitHub Pages is case-sensitive. A transparent PNG works best. If no file is found, a built-in drawn crest is used instead.

## Deploy to GitHub Pages

1. Upload `index.html`, `css`, `js`, `img` and `supabase` to your repository root (replace everything).
2. **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Hard refresh once (Ctrl/Cmd + Shift + R) after it deploys.

## Sync is merge-based, not overwrite-based

Every sync fetches the cloud copy first, merges by recipe ID (keeping whichever version was edited most recently), and unions favourites, pantry ticks, ratings, brew history and your share list from both sides before writing back. An empty device can never wipe a populated cloud library.

## Sharing recipes (different to sharing the app)

Recipe Library → **Export Recipe Pack** (all / favourites / mine), or the ⬇ icon on any recipe. Images are embedded as Base64 inside the JSON. **Import JSON** understands both BrewGenge's own format and common verbose recipe JSON. No account needed.

## Features

Dashboard · Recipe Library · Recipe Detail popup (image, style comparison, live shopping list, star rating, brew history) · Equipment profiles · Create a Brew · Find a Brew · Fermentables · Hops (Tinseth IBU) · Water (mash/sparge temps + volumes, automatic salt calculator) · Brew Day · Fermentation log · Cost · Find Ingredients · Find a Supplier · Share BrewGenge · Account & Sync · Read Me.

## Changelog

- **Share BrewGenge tab.** Name + email + your name, writes the invite, opens it in your email app ready to send. Copy invite / copy link / native share sheet as alternatives. Live preview and a synced "Shared with" history.
- **Standalone login page.** Proper full-screen sign-in with a brand bar, hero panel and underline tabs, rather than a form buried in a settings tab. Sign in / Create account, Stay signed in ticked by default, Continue without an account. Busy states on the button, and clear errors for wrong password, already-registered, signups-disabled and the "Confirm email is still ON" case.
- **Dark mode toggle** in the header, persisted per device, applied across every tab, table, modal and the login screen.
- **Big BrewGenge crest** behind the login screen, plus a subtle watermark behind the app. Logo background made transparent so it works on light and dark.
- Safe merge sync, water/salt calculator, recipe detail popup — all unchanged.
