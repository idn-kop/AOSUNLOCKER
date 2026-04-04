# Google Sheets Public API Setup

This is a second Apps Script project used only for public JSON data.

## Why this exists

- Your admin panel stays private
- Your website gets a public read-only API
- The public API has no add or edit form

## Files to use

Copy these files into a new standalone Apps Script project:

- [Code.gs](C:\Users\Farss\Desktop\qodeer\AOSUNLOCKER\apps-script-public\Code.gs)
- [appsscript.json](C:\Users\Farss\Desktop\qodeer\AOSUNLOCKER\apps-script-public\appsscript.json)

## What you must change

Inside `Code.gs`, replace:

```js
const SPREADSHEET_URL = 'PASTE_YOUR_SPREADSHEET_URL_HERE';
```

with your real Google Sheets URL.

Example:

```text
https://docs.google.com/spreadsheets/d/...../edit
```

## Deployment

Deploy this second script as:

- Execute as: `Me`
- Who has access: `Anyone`

## Test URLs

After deploy, these should work:

### Categories

```text
WEB_APP_URL?view=categories
```

### Files by category

```text
WEB_APP_URL?view=files&category=fix-reboot
```

### Single file detail

```text
WEB_APP_URL?view=file&id=fix-reboot-ana-an00
```

## Final website step

After the public API works, paste its web app URL into:

- [site-config.js](C:\Users\Farss\Desktop\qodeer\AOSUNLOCKER\public\site-config.js)
