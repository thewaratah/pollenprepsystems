Push the Waratah Advanced Script & Automation docs to Google Drive.

This converts all 14 markdown files in `The Waratah/docs/Advanced Script & Automation/` to Google Docs and uploads them to the shared Drive folder.

Run this command:
```bash
cd "The Waratah/docs" && node deploy-docs-to-drive.js advanced
```

This is a manual push — it is NOT run automatically on `/deploy waratah` (only staff docs are auto-pushed).
Use this after running `/docs` or after manual edits to the advanced docs.
