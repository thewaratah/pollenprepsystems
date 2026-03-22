Use the `airtable-mcp-agent` sub-agent to perform a cross-venue schema audit.

Scope: $ARGUMENTS

The agent will:
1. Query both Airtable bases (Sakura: appNsFRhuU47e9qlR, Waratah: appfcy14ZikhKZnRS)
2. Compare table schemas — field names, field types, and select options
3. Report field-level differences between venues
4. Flag fields that exist in one venue but not the other
5. Identify potential schema drift from feature additions

If no scope is specified, audit the Items and Recipes tables by default.
