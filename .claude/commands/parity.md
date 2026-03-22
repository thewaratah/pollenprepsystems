Use the `parity-check-agent` sub-agent to run a cross-venue parity check.

Task: $ARGUMENTS

If no arguments provided, run a full parity scan across all Tier 1 and Tier 2 file pairs.

Scope options:
- `all` — full scan of all paired files + utility functions
- `utilities` — check the 8 shared utility functions across all Airtable scripts only
- `[filename]` — check a specific file pair (e.g., `RecipeScaler.gs`)
