# No new SQL required
Export Recipe Pack and Import Recipe Pack operate entirely in the browser. Uploaded images are embedded in the JSON as Base64 data URLs.

The existing user_app_state Supabase table is sufficient for private account sync.

A future BrewGenge Community feature will require a new migration for recipe ownership, public visibility, shares/follows, and image storage policies.
