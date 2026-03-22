Use the `documentation-agent` sub-agent to update PREP system documentation.

What changed (or leave blank for auto-detect): $ARGUMENTS

The agent will make minimal, targeted updates to whichever CLAUDE.md files are affected (`The Waratah/CLAUDE.md` or `Sakura House/CLAUDE.md`). It does not rewrite — it patches only what is inaccurate or missing, and flags any other stale sections it notices.

**Waratah docs in scope** (5 files in `The Waratah/docs/`):
- `SYSTEM_OVERVIEW.md` — all-staff overview, weekly cycle, quick reference
- `PREP_SHEET_WEEKLY_COUNT_GUIDE.md` — reading prep docs, Recipe Scaler, feedback
- `STOCK_COUNT_ORDERING_GUIDE.md` — stock counting, ordering pipeline, troubleshooting
- `TECHNICAL_REFERENCE.md` — script internals, algorithms, deployment
- `AIRTABLE_SCHEMA.md` — complete 15-table Airtable schema

**Sakura docs in scope:** `STAFF_GUIDE.md`, `MANAGER_GUIDE.md`, `NEW_STARTER_WELCOME.md`, `TROUBLESHOOTING.md`, `TECHNICAL_REFERENCE.md`, `AIRTABLE_SCHEMA.md` in `Sakura House/docs/`.

**Advanced Script & Automation docs (both venues):**
Every invocation of `/docs` must also update the Advanced Script & Automation files if any scripts changed:
- **Sakura:** `Sakura House/docs/Advanced Script & Automation/` (11 files)
- **Waratah:** `The Waratah/docs/Advanced Script & Automation/` (14 files)

Only update the specific explainer files for scripts that changed. Do NOT push to Google Drive — that is a separate manual step:
- Sakura: `/push-advanced-docs`
- Waratah: `/push-waratah-advanced-docs`

If the change affects how staff interact with the system (counting, reading docs, using the Recipe Scaler, Feedback Form, or Slack notifications), patch the relevant doc file(s). After updating, remind the user to push docs to Drive if needed.
