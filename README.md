# Ultimate Brew Calculator (Guten 50L edition)

A free, static brew calculator with optional cloud sync. Pick a recipe, set your batch size, and every sheet, grain bill, hop schedule, water salts, ingredient cost, scales automatically. Runs entirely in the browser, hosted for free on GitHub Pages, with an optional Supabase backend so your recipes and brew logs follow you across devices.

## Features

- **Dashboard, Recipe Library, Create a Brew, Find a Brew** — pick, search, build from scratch, or import a recipe (paste a JSON block from an AI chat, paste freeform notes, or quick-generate from a style template).
- **Fermentables, Hops, Water, Brew Day, Fermentation** — full scaling engine, Tinseth IBU calculator, Floraville (Hunter Water) water/salt calculator, live brew-day log.
- **Cost, Find Ingredients, Find a Supplier** — Brewman-based pricing (editable), a manual price comparison against KegLand, and an estimated landed-cost ranking across 5 Australian suppliers including delivery.
- **Account & Sync** — sign in with just an email (magic link, no password), and your whole app state (My Recipes, custom prices, brew logs) syncs to a Supabase project automatically. Skip this entirely and everything still works, saved locally in your browser only.

## Part 1: Hosting on GitHub Pages

1. Create a new GitHub repository (e.g. `brew-calculator`), set to **Public**.
2. Upload `index.html`, the `css/` folder, and the `js/` folder to the repository root.
3. Go to **Settings > Pages**. Under "Build and deployment", set **Source** to "Deploy from a branch", choose your default branch and the **/ (root)** folder, then **Save**.
4. Your site goes live at `https://yourusername.github.io/brew-calculator/` within a minute or two.

## Part 2: Setting up Supabase (optional, for cloud sync)

1. Create a free account at [supabase.com](https://supabase.com) and a new project.
2. Open the **SQL Editor**, paste in the full contents of `supabase/001_schema.sql`, and click **Run**.
3. Paste in the full contents of `supabase/002_app_state_sync.sql` and click **Run**. (This must run after 001.)
4. Go to **Settings > API** (or **Settings > Data API**), copy your **Project URL** and **anon/publishable key**.
5. Open `js/supabase-client.js` and set:
   ```js
   const SUPABASE_URL = "https://your-project-ref.supabase.co";
   const SUPABASE_ANON_KEY = "your-publishable-key";
   ```
6. Push the change to GitHub. Open your live site, go to **Account & Sync**, enter your email, and click the magic link it sends you.

**Never put your Supabase `service_role` / secret key in this file or anywhere in the repository.** Only the anon/publishable key belongs in front-end code, it's safe by design as long as Row Level Security is enabled (it is, by `001_schema.sql`).

## Two database files, and why

- **`001_schema.sql`** — a fully normalized relational schema: `recipes`, `ingredients`, `ingredient_prices`, `suppliers`, `batches` and their child tables, plus a `fn_batch_landed_cost()` function that computes a real per-supplier landed cost via SQL joins. This is the "correct" long-term design for a multi-user app with a shared ingredient/price catalog.
- **`002_app_state_sync.sql`** — a single `user_app_state` table storing your entire app state as one JSON document per user. This is what the app actually syncs to today, it was the pragmatic choice to get working cloud sync quickly rather than wiring up 15 separate tables individually. You can migrate to the fully normalized tables later without losing any data, this table is purely additive.

## Adding your own recipe

Easiest: use the **Create a Brew** tab in the app itself, a guided form with a live preview. Alternatively, edit `js/data.js` directly and add an entry to the `RECIPES` array following the existing pattern.

## Limitations, please read

- Find a Brew and Find a Supplier are **not** live API integrations. A static site can't safely call an AI search API (that needs a server-side key) or a live pricing API (none of the Australian suppliers publish one). Both tabs explain the workaround built in instead.
- All recipes other than the HenHouse Incredible IPA clone are original style formulations, not exact commercial clones.
- Ingredient and delivery prices were researched on 8 Sep 2026 and are snapshots, not live feeds. Always confirm the actual cart total before ordering.
- If you never set up Supabase, or you're signed out, everything still works, saved only in that browser's local storage.

## License

For personal use. Adapt as you like.
