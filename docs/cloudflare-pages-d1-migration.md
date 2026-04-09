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

## Mandatory hardening after first deploy

### 1. Separate preview and production D1

Do not leave `preview_database_id` equal to the production `database_id`.

Recommended flow:

1. Log in to Cloudflare CLI:

```bash
npx wrangler login
```

2. Create a preview database:

```bash
npx wrangler d1 create aosunlocker-preview
```

3. Copy the returned `database_id`.
4. Update `preview_database_id` in `wrangler.jsonc`.
5. In Cloudflare Pages, bind the preview environment to that preview D1 database.

Risk if skipped:

- Preview deploys can write to the same live D1 database used by production.
- Test edits can leak into real customer data.

### 2. Put admin behind Cloudflare Access

Recommended dashboard path:

1. Open `Cloudflare Dashboard`.
2. Go to `Zero Trust`.
3. Open `Access` > `Applications`.
4. Click `Add an application`.
5. Choose `Self-hosted`.
6. Add these protected paths:
   - `https://aosunlocker.com/admin*`
   - `https://aosunlocker.com/api/admin*`
7. Create an allow policy for only your email address or your team email list.

Risk if skipped:

- Admin still depends only on the bearer token.
- Bots can still scan the admin surface and hammer the admin API.

### 3. Verify the deployment

Run this repo check:

```bash
npm run verify:cloudflare
```

Optional custom domain:

```bash
npm run verify:cloudflare -- --base-url=https://your-domain.com
```

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
- The `verify:cloudflare` script checks the live security headers and warns if `preview_database_id` still points at production.
