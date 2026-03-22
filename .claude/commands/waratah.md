Use the `waratah-prep-agent` sub-agent to handle this Waratah PREP system task:

$ARGUMENTS

The agent will read `The Waratah/CLAUDE.md` first, then implement or investigate as needed. It specialises in the two-script architecture (Airtable automations + GAS export pipeline), the `Item Name` linked-record recipe pattern, `allowedTopLevelItemTypes` variants, and `.claspignore` safety.

Waratah has 5 help docs in `The Waratah/docs/` (SYSTEM_OVERVIEW, PREP_SHEET_WEEKLY_COUNT_GUIDE, STOCK_COUNT_ORDERING_GUIDE, TECHNICAL_REFERENCE, AIRTABLE_SCHEMA) synced to Google Drive via `deploy-docs-to-drive.js`. If the change affects staff workflow or system behaviour, flag which doc(s) need updating.
