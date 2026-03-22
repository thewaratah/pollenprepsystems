Push the Advanced Script & Automation docs to Google Drive.

This converts all 11 markdown files in `Sakura House/docs/Advanced Script & Automation/` to Google Docs and uploads them to the shared Drive folder.

Run this command:
```bash
cd "Sakura House/docs" && node deploy-docs-to-drive.js advanced
```

This is a manual push — it is NOT run automatically on `/deploy sakura` (only staff docs are auto-pushed).
Use this after running `/update-scripts-docs` to sync changes to Drive.
