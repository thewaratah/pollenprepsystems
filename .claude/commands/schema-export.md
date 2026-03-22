Export both venues' Airtable schemas to a Google Sheet using MCP tools.

Scope: $ARGUMENTS

## Steps

1. **Pull schemas** via Airtable MCP `list_tables_for_base` for both venues:
   - Sakura House: `appNsFRhuU47e9qlR`
   - Waratah: `appfcy14ZikhKZnRS`

2. **Create Google Sheet** via Google Workspace MCP `create_spreadsheet`:
   - Title: `PREP Systems — Airtable Schema Reference`
   - Email: `evan@pollenhospitality.com`
   - Sheets: `["Waratah", "Sakura House", "Schema Parity"]`

3. **Write venue tabs** via `modify_sheet_values`. For each venue tab:
   - Header row: `Table | Field Name | Field Type | Field ID | Description`
   - One row per field, grouped by table (insert a blank row between tables)
   - Sort tables alphabetically, fields in their natural order
   - Description column: use Airtable field `description` if present, otherwise blank

4. **Write parity tab** via `modify_sheet_values`:
   - Header row: `Table | Field Name | Waratah Type | Sakura Type | Status`
   - Compare tables by name across venues
   - Status values:
     - `MATCH` — field exists in both with same type
     - `TYPE MISMATCH` — field exists in both but types differ
     - `WARATAH ONLY` — field exists only in Waratah
     - `SAKURA ONLY` — field exists only in Sakura
     - `TABLE: WARATAH ONLY` / `TABLE: SAKURA ONLY` — entire table missing from one venue
   - Only show non-MATCH rows (mismatches and missing fields)
   - Sort by Table name, then Status, then Field Name

5. **Return the Sheet URL** and report summary stats:
   - Total tables per venue
   - Total fields per venue
   - Number of mismatches/missing fields

## Notes
- This command is re-runnable. Each run creates a new Sheet (does not update an existing one).
- If scope argument is provided (e.g., "Items Recipes"), only export those tables.
- No GAS code is involved — this runs entirely via MCP tools in the Claude session.
