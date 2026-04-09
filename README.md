# AOSUNLOCKER

Cleaned repo for the Cloudflare migration.

## Stack

- `Vite + TypeScript` for the public website and static admin page
- `Cloudflare Pages Functions` for `/api` and `/api/admin`
- `Cloudflare D1` for brands, folders, subfolders, and files

## Main folders

- [`src`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\src): frontend source
- [`public`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\public): only the assets still used by the site
- [`functions`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\functions): Cloudflare Pages Functions API
- [`migrations`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\migrations): D1 schema and import SQL
- [`scripts`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\scripts): migration helpers
- [`docs`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\docs): deployment and migration notes

## Important files

- [`public/site-config.js`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\public\site-config.js): frontend API config
- [`functions/api/[[path]].js`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\functions\api\[[path]].js): public and admin API
- [`migrations/0001_cloudflare_d1_schema.sql`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\migrations\0001_cloudflare_d1_schema.sql): base D1 schema
- [`scripts/export-apps-script-to-d1.mjs`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\scripts\export-apps-script-to-d1.mjs): legacy data export helper
- [`docs/cloudflare-pages-d1-migration.md`](C:\Users\Farss\Desktop\BLK\AOSUNLOCKER\docs\cloudflare-pages-d1-migration.md): deploy and cutover guide

## Notes

- Old GitHub Pages, Apps Script, and Google Sheets repo files were removed.
- Lighthouse reports, temp files, and unused assets were removed.
- Local-only clutter is now ignored in `.gitignore`.
- Run `npm run verify:cloudflare` after deploys to confirm live security headers and preview DB separation.
