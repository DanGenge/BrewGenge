# BrewGenge · Ultimate Brew Calculator

A free, static brew calculator with optional Supabase cloud sync. Built around the Guten 50L, with a full recipe library, scaling engine, water and hop calculators, cost and supplier estimates, equipment profiles, pantry costing, and shareable recipe packs.

## Deploy to GitHub Pages

1. Upload `index.html`, the `css`, `js` and `supabase` folders to your repository root.
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Open the published URL. Hard refresh once (Ctrl/Cmd + Shift + R) if an old cached version shows.

## Supabase (optional, for cloud sync and separate accounts)

1. In your Supabase project open the **SQL Editor** and run `supabase/001_user_app_state.sql`.
2. The app is already configured with the project URL and publishable key in `js/app.js`.
3. Add your GitHub Pages URL under **Authentication → URL Configuration** as an allowed redirect.

**Do additional accounts need SQL?** No. One run of `001_user_app_state.sql` covers every user. Each account gets its own private row via Row Level Security. Give a mate a copy of the site and you stay completely separate.

## Sharing recipes

Recipe Library → **Export Recipe Pack**. Choose all recipes, favourites, or your BrewGenge originals. Uploaded images are embedded as Base64 inside the JSON and import with the recipe. Single recipes export with the ⬇ icon on each row. Import with **Import JSON**.

**No additional SQL is required for recipe packs** — they work entirely in the browser. A future BrewGenge Community feature (live sharing between accounts) would need a separate migration.

## Features

Dashboard · Recipe Library (condensed list, favourites first, rename/delete/photo per brew) · Equipment profiles · Create a Brew · Find a Brew · Fermentables · Hops (Tinseth IBU) · Water · Brew Day · Fermentation log · Cost (with pantry "Already have?" exclusion) · Find Ingredients · Find a Supplier (landed cost ranking) · Account & Sync · Read Me.
