# Google Sheets Admin Setup

This setup gives you a lightweight admin panel without editing JSON or touching the website code every time.

## What you get

- A Google Sheets spreadsheet as the data source
- A Google Apps Script web admin
- A simple form for adding download files
- Auto-fill for file name and file size from Google Drive link
- Categories stored in a `Settings` sheet
- File rows stored in a `Downloads` sheet

## Sheets structure

The script auto-creates these sheets:

### `Settings`

Used for categories.

| category_id | category_label |
| --- | --- |
| removed-id | Removed ID |
| repair-chip-damage | Repair Chip Damage |
| fix-reboot | Fix Reboot |
| xml-qualcomm | XML Qualcomm |
| otg-file | OTG File |
| repair-imei | Repair IMEI |

### `Downloads`

Used for file rows.

| id | category_id | category_label | title | subtitle | summary | size | price | drive_url | featured | status | created_at | updated_at |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Current code now also expects these public-download fields in the same row flow:

- `date`
- `visits`
- `downloads`

## Deploy steps

1. Create a new Google Sheet.
2. Open `Extensions -> Apps Script`.
3. Copy all files from [`apps-script`](C:\Users\Farss\Desktop\qodeer\AOSUNLOCKER\apps-script) into the Apps Script project.
4. Save the project.
5. Run `doGet` once and grant permissions.
6. Click `Deploy -> New deployment`.
7. Choose `Web app`.
8. Set:
   - Execute as: `Me`
   - Who has access: `Only myself` or your chosen admins
9. Deploy and open the web app URL.

## Fields in the form

- `Category`: where the file belongs
- `Title`: main download title
- `Subtitle`: small line used in the list page
- `Summary`: used in detail page text
- `Date`: shown in the file list and detail page
- `Size`: file size like `5.30 GB`
- `Visits`: public counter field
- `Downloads`: public counter field
- `Price`: `Free`, `$10`, or any text you want
- `Google Drive Link`: your existing file link
- `Featured`: marks highlighted entries
- `Status`: use `published` or `draft`

## Auto-fill flow

1. Paste the Google Drive file link.
2. Click `Auto Fill From Drive`.
3. The admin tries to read:
   - file name
   - file size
4. You only need to finish the title and price, then save.

## Recommended next step

After this admin is working, the website can be updated to fetch rows from Google Sheets instead of hardcoded TypeScript data.
