Use the `gas-code-review-agent` sub-agent to review recently changed GAS files.

If specific files are provided, review those: $ARGUMENTS

Otherwise review all GAS files modified in the current session. Apply the full P0–P3 severity checklist including PREP-specific rules (correct base IDs per venue, `.claspignore` safety, no cross-venue staff name contamination, `clearContent()` not `clear()`). Return a structured report with blocking issues (P0/P1) listed first.
