# Cloudflare Pages + D1 Migration

## What changed

- Public website stays in the current Vite frontend.
- Public data now targets `/api` instead of Google Apps Script.
- A new static admin panel lives at `/admin.html`.
- Pages Functions handle `/api` and `/api/admin`.
- D1 becomes the source of truth for brands, folders, subfolders, and files.
- Local static fallback for folder/file data is disabled when the Cloudflare API is active, so stale old data does not reappear.

## Cleanup status

- Legacy Google Apps Script source has been removed from this repo.
- The repo is now centered on `Pages + Functions + D1`.
- If you still need the old Apps Script project as external backup, keep it only in Google Apps Script, not in this repo.

## Cloudflare setup

1. Create a Cloudflare D1 database, for example `aosunlocker`.
2. Bind that database to your Pages project as `DB`.
3. Add a Pages environment variable named `ADMIN_TOKEN`.
4. Use a long random token for `ADMIN_TOKEN`.
5. Deploy the site so Pages serves the static frontend and the `functions/api/[[path]].js` API.

## Run the schema

```bash
npx wrangler d1 execute aosunlocker --remote --file migrations/0001_cloudflare_d1_schema.sql
```

## Export data from the old Apps Script API

```bash
node scripts/export-apps-script-to-d1.mjs --source=https://script.google.com/macros/s/YOUR_OLD_EXEC/exec
```

That command writes a SQL import file to:

```text
migrations/generated/import-from-apps-script.sql
```

## Import the exported data into D1

```bash
npx wrangler d1 execute aosunlocker --remote --file migrations/generated/import-from-apps-script.sql
```

## Deploy order

1. Run the D1 schema migration.
2. Export from the old Apps Script API.
3. Import the generated SQL into D1.
4. Set `ADMIN_TOKEN` in Cloudflare Pages.
5. Deploy this repo to Cloudflare Pages.
6. Open `/admin.html`.
7. Paste the same `ADMIN_TOKEN`.
8. Click `Connect Panel`.
9. Run `Integrity Scan`.
10. Add, edit, and delete test folders/files from the new admin.

## Notes

- `public/site-config.js` now points to `/api` and `/api/admin`.
- The admin token is not baked into the frontend code.
- The admin panel stores the token only in the current browser tab `sessionStorage`.
- Public cache refresh is handled by the API automatically after every write.
- If you need a manual bump, use the `Refresh Public Cache` button in `/admin.html`.
- For stronger protection, put `/admin` and `/api/admin/*` behind Cloudflare Access and add a rate-limit rule in the dashboard.
