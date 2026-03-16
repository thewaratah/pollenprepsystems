# THE WARATAH PREP SYSTEM

Production instance of the PREP system for The Waratah venue.

**Parent Documentation:** See main [CLAUDE.md](../CLAUDE.md) for comprehensive system architecture and workflows.

---

## Quick Reference

**Airtable Base:** `appfcy14ZikhKZnRS`

**Google Apps Script:** `10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8`

**Google Drive Folders:**
- Base: `1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx` - https://drive.google.com/drive/folders/1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx
- Templates: `1f4InQCmccjUSnpEqJzz1VnrtSfmweElU` - https://drive.google.com/drive/folders/1f4InQCmccjUSnpEqJzz1VnrtSfmweElU
- Template Upload: `1nIcn_xWjvtLbshoKLTUmcdpd75rktZwG` - https://drive.google.com/drive/folders/1nIcn_xWjvtLbshoKLTUmcdpd75rktZwG
- Script Backups (Airtable + GAS): `1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp` - https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp
- Archive: (to be configured)

**Knowledge Platform:** https://prep-knowledge-platform.vercel.app/?venue=waratah

**Staff Guide:** [`docs/guides/waratah-staff-guide.md`](docs/guides/waratah-staff-guide.md) — plain-English guide for bar staff (copy-paste into Word/Google Docs for distribution)

**Supabase RAG Tables:** `rag_chunks`, `rag_documents` (joined via `match_documents()` — `waratah_rag_*` tables are empty, do not use)

---

## Script Architecture

### Two-Script System

The Waratah PREP system uses a two-script architecture:

**1. Airtable Automation Scripts** (run INSIDE Airtable)
- `Waratah_ClearWeeklyCount.gs` - Reset weekly counts
- `Waratah_FinaliseCount.gs` - Validate stocktake
- `Waratah_GeneratePrepRun.gs` - Generate prep tasks
- `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` - Mark exports as REQUESTED
- `Waratah_GenerateStockOrders.gs` - Generate stock orders from stocktake (writes to Stock Orders table; idempotent — deletes existing orders before regenerating)
- `Waratah_ExportOrderingDoc.gs` - Trigger ordering doc export via GAS polling (sets "Ordering Export State" = REQUESTED on Count Sessions)

**2. Google Apps Script** (run in GAS environment)
- `GoogleDocsPrepSystem.gs` - Main export processor + Slack notifications + ordering export polling (`processOrderingExportRequests()`)
- `FeedbackForm.gs` - Feedback collection backend
- `FeedbackFormUI.html` - Feedback form UI
- `RecipeScaler.gs` - Recipe scaling backend
- `RecipeScalerUI.html` - Recipe scaler UI

**Ordering Export Polling** (`processOrderingExportRequests()` in `GoogleDocsPrepSystem.gs`):
- Polls Count Sessions table for records where "Ordering Export State" = "REQUESTED"
- Calls `exportCombinedOrderingDoc_()` to generate the ordering doc
- Sets "Ordering Export State" to COMPLETED (success) or ERROR (failure)
- Requires a GAS time-driven trigger running every 1-2 minutes

**Airtable Tables/Fields for Stock Ordering:**
- **Count Sessions** table: "Ordering Export State" single-select field (options: REQUESTED, COMPLETED, ERROR)
- **Stock Orders** table: one record per item with supplier, qty, unit, linked to Count Session. `Waratah_GenerateStockOrders.gs` Phase 8 cleanup deletes existing orders before regenerating (idempotent re-runs). Accepts sessions with status "Validated" or "Orders Generated".

**Note — superseded script:**
- `GeneratePrepSheet.gs` (single-record Airtable automation version) is **superseded** by `GeneratePrepSheet_TimeBasedPolling.gs` for all use cases. The single-record version requires Airtable automation infrastructure to pass `recordId` and cannot be run manually. The polling version works for both manual runs and future scheduled triggers. Use only the polling version.

### Critical: .claspignore Configuration

The `.claspignore` file ensures Airtable scripts are NOT uploaded to Google Apps Script:

```
# Airtable-only scripts (not needed in GAS deployment)
Waratah_ClearWeeklyCount.gs
Waratah_FinaliseCount.gs
Waratah_GeneratePrepRun.gs
Waratah_GeneratePrepSheet_TimeBasedPolling.gs
Waratah_InitStockCount.gs
Waratah_ValidateStockCount.gs
Waratah_GenerateStockOrders.gs
Waratah_ExportOrderingDoc.gs

# Debug utilities (manual testing only)
Debug.gs

# Python scripts
*.py

# SQL files
*.sql

# Shell scripts
*.sh

# Node.js migration scripts (belong to knowledge platform, not GAS)
setup/**

# Other excludes
.clasp.json
.claspignore
```

**Why this matters:**
- If Airtable scripts are uploaded to GAS, you get duplicate function name errors
- Each script has `main()`, `formatSydneyTimestamp_()`, `safeField_()` functions
- GAS can't have multiple scripts with the same function names

### Script Naming Convention

All Waratah scripts use the `Waratah_` prefix to differentiate from Sakura House:

| Purpose | Filename | Environment |
|---------|----------|-------------|
| Clear counts | `Waratah_ClearWeeklyCount.gs` | Airtable |
| Finalize stocktake | `Waratah_FinaliseCount.gs` | Airtable |
| Generate prep run | `Waratah_GeneratePrepRun.gs` | Airtable |
| Mark for export | `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` | Airtable |
| Generate stock orders | `Waratah_GenerateStockOrders.gs` | Airtable |
| Trigger ordering export | `Waratah_ExportOrderingDoc.gs` | Airtable |
| Export to docs | `GoogleDocsPrepSystem.gs` | Google Apps Script |
| Feedback form | `FeedbackForm.gs` + `.html` | Google Apps Script |
| Recipe scaler | `RecipeScaler.gs` + `.html` | Google Apps Script |

---

## Configuration

### Script Properties (Google Apps Script)

Set in: Google Apps Script Editor → Project Settings → Script Properties

```bash
# Airtable
WARATAH_AIRTABLE_BASE_ID=appfcy14ZikhKZnRS
AIRTABLE_PAT=<stored in GAS Script Properties>

# Google Drive
WARATAH_DOCS_FOLDER_ID=1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx
WARATAH_TEMPLATES_FOLDER_ID=1f4InQCmccjUSnpEqJzz1VnrtSfmweElU
WARATAH_ARCHIVE_FOLDER_ID=<TO_BE_CONFIGURED>

# Waratah Templates (Google Doc IDs)
WARATAH_TEMPLATE_BATCHING_ID=<google-doc-id>
WARATAH_TEMPLATE_INGREDIENT_PREP_ID=<google-doc-id>
WARATAH_TEMPLATE_ORDERING_ID=<google-doc-id>       # Combined ordering doc template (replaces per-staff Andie/Blade templates)

# Slack Webhooks
SLACK_WEBHOOK_WARATAH_PREP=<WEBHOOK_URL>   # Required by FeedbackForm.gs for production feedback posts; falls back to SLACK_WEBHOOK_EV_TEST if absent
SLACK_WEBHOOK_WARATAH_TEST=<WEBHOOK_URL>
SLACK_WEBHOOK_EV_TEST=<WEBHOOK_URL>        # Dev fallback for FeedbackForm.gs + combined ordering doc notifications

# Security
MANUAL_TRIGGER_SECRET=<GENERATE_RANDOM_SECRET>
RECIPE_SYNC_SECRET=<stored in GAS Script Properties>

# Web Apps (set after deployment)
WARATAH_FEEDBACK_FORM_URL=<DEPLOYED_WEB_APP_URL>
WARATAH_RECIPE_SCALER_URL=<DEPLOYED_WEB_APP_URL>
```

### Knowledge Platform Environment (.env.local)

```bash
# Venue Selection
NEXT_PUBLIC_VENUE_ID=waratah

# Waratah Configuration
WARATAH_AIRTABLE_BASE_ID=appfcy14ZikhKZnRS
WARATAH_DOCS_FOLDER_ID=1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx
WARATAH_GAS_WEBAPP_URL=<DEPLOYED_URL>

# Shared credentials (same as Sakura) — stored in .env.local, NOT committed
NEXT_PUBLIC_SUPABASE_URL=<see .env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local>
SUPABASE_SERVICE_ROLE_KEY=<see .env.local>
OPENAI_API_KEY=<see .env.local>
ANTHROPIC_API_KEY=<see .env.local>
CLAUDE_MODEL=claude-sonnet-4-20250514
AIRTABLE_PAT=<see .env.local>
```

---

## Weekly Workflow

1. **Saturday AM:** Clear Weekly Count (automatic)
2. **Sunday:** Physical stocktake — staff count every item in Airtable Interface
3. **Monday AM:** Finalize Count (automatic) → Generate Prep Run → Export 2 prep docs (Ingredient Prep + Batching Run Sheets) → Slack to prep channel
4. **Monday (after bar stock count):** Combined Ordering Run Sheet generated via either: (a) manual trigger (`action=ordering` POST to doPost), or (b) Airtable button (`Waratah_ExportOrderingDoc.gs` sets "Ordering Export State" = REQUESTED on Count Sessions → GAS `processOrderingExportRequests()` polls and generates doc). Pulls bar stock orders from Stock Orders table + prep-only items from Ingredient Requirements, grouped by supplier → Slack to Evan's channel (SLACK_WEBHOOK_EV_TEST)
5. **Monday (before 2pm):** Ordering completed by management using combined ordering doc
6. **Tuesday:** Orders arrive
7. **Tuesday–Wednesday:** Execute prep tasks from the docs

---

## Differences from Sakura House

### Recipes
- **Wasabi Mayo:** 30g wasabi (vs 35g at Sakura) - milder for Waratah clientele
- (Add more recipe variations as identified)

### Par Levels
- Start with Sakura's par levels, then adjust based on demand
- Expected to be ~20-30% lower than Sakura initially
- Review and optimize after first month

### Staff
- Ordering staff: **Andie**, **Blade** (vs Gooch/Sabs at Sakura)
- Prep Team Lead: TBD
- Manager: TBD

---

## Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Airtable Base | ✅ Complete | Schema replicated from Sakura |
| GAS Project | ✅ Complete | Deployed and tested (2026-02-12) |
| Drive Folders | ✅ Complete | Base + Templates configured |
| Script Properties | ✅ Complete | All properties configured |
| Templates | ✅ Complete | 3 templates: Batching, Ingredient Prep, Combined Ordering (Phase 3 — per-staff Andie/Blade templates retired) |
| Web Apps | ✅ Complete | Deployed 2026-02-26; `RECIPE_SCALER_URL` updated to Waratah-specific URL |
| Knowledge Platform | ✅ Complete | Deployed at prep-knowledge-platform.vercel.app (2026-02-20) |
| RAG Knowledge Base | ✅ Complete | Waratah content ingested; data in `rag_chunks` + `rag_documents` tables (`waratah_rag_*` tables are empty — do not use) |

---

## Recent Changes

### 2026-03-16 — Stock Ordering Scripts & Ordering Export Polling

**`Waratah_GenerateStockOrders.gs` — New Airtable automation script:**
- Generates stock orders from stocktake data, writing one record per item to the Stock Orders table (supplier, qty, unit, linked to Count Session)
- Phase 8 cleanup step deletes existing orders before regenerating (idempotent re-runs)
- Accepts Count Sessions with status "Validated" or "Orders Generated"

**`Waratah_ExportOrderingDoc.gs` — New Airtable automation script:**
- Triggered via Airtable button; sets "Ordering Export State" = REQUESTED on the Count Sessions record
- GAS polling function picks up the request and generates the ordering doc

**`GoogleDocsPrepSystem.gs` — `processOrderingExportRequests()` added:**
- Polls Count Sessions table for "Ordering Export State" = "REQUESTED"
- Calls `exportCombinedOrderingDoc_()` to generate the combined ordering doc
- Sets state to COMPLETED or ERROR after processing
- Requires a GAS time-driven trigger every 1-2 minutes

**Count Sessions table — new field:**
- "Ordering Export State" single-select field added (options: REQUESTED, COMPLETED, ERROR)

**`.claspignore` updated:**
- Now excludes `Waratah_GenerateStockOrders.gs` and `Waratah_ExportOrderingDoc.gs` (plus previously added `Waratah_InitStockCount.gs`, `Waratah_ValidateStockCount.gs`, `Debug.gs`)

**Key notes for future sessions:**
- Ordering doc can now be triggered two ways: (a) manual POST with `action=ordering`, or (b) Airtable button via ExportOrderingDoc + GAS polling
- `Waratah_GenerateStockOrders.gs` is idempotent — safe to re-run on the same session
- `processOrderingExportRequests()` needs a GAS time-driven trigger (not automatic on deploy)

---

### 2026-03-16 — Phase 3: Combined Ordering Doc, Monday AM Export Slimmed to 2 Docs

**`GoogleDocsPrepSystem.gs` — Monday AM export reduced to 2 docs (deployed via clasp push):**
- `processExportRequests_` now generates only Ingredient Prep Run Sheet + Batching Run Sheet on Monday AM
- Ordering docs are no longer produced during the Monday AM automatic export

**`GoogleDocsPrepSystem.gs` — New manual ordering trigger (`action=ordering` in doPost):**
- New endpoint: POST with `action=ordering` generates a single "Ordering Run Sheet" combining:
  - Bar stock orders from the **Stock Orders** table (items with `Bar Stock = true`, session status = "Orders Generated")
  - Prep-only items from **Ingredient Requirements** (non-bar-stock items from the active prep run)
- Items grouped by supplier in the output doc
- Slack notification sent to `SLACK_WEBHOOK_EV_TEST` (Evan's channel only, not per-staff channels)
- New test function: `exportCombinedOrderingDoc_TEST()`

**`GoogleDocsPrepSystem.gs` — Deleted functions and CFG props:**
- Removed: `buildOrdering_`, `createOrderingDoc_`, `createOrReplaceOrderingDoc_`, `toSupplierBlocks_`, `matchStaff_`
- Removed CFG props: `templateOrderingAndie`, `templateOrderingBlade`, `slackAndie`, `slackBlade`, `staffAliases`
- New CFG props: `templateOrderingCombined` (reads `WARATAH_TEMPLATE_ORDERING_ID`), Stock Orders table/fields, Count Sessions table/fields, `itemBarStock` field

**Script Properties changed:**
- Removed: `WARATAH_TEMPLATE_ANDIE_ORDERING_ID`, `WARATAH_TEMPLATE_BLADE_ORDERING_ID`, `SLACK_WEBHOOK_WARATAH_ANDIE`, `SLACK_WEBHOOK_WARATAH_BLADE`
- Added: `WARATAH_TEMPLATE_ORDERING_ID` (combined ordering template)

**Key notes for future sessions:**
- Monday AM automation produces exactly 2 docs (Ingredient Prep + Batching) — ordering is a separate manual step
- Combined ordering doc requires Stock Orders to exist (generated by `Waratah_GenerateStockOrders.gs` after bar stock count)
- Per-staff ordering (Andie/Blade split) is fully removed — all ordering is now in one combined doc
- `SLACK_WEBHOOK_EV_TEST` is the only webhook used for ordering notifications (temporary — may move to a production channel later)

---

### 2026-03-16 — Production Volume Bug Fix, Doc Layout Changes, Secrets Scrub & Git Init

**`Waratah_GeneratePrepRun.gs` — Sub-recipe production volume fix (Airtable script, manual paste required):**
- Pass 2 sub-recipe task finalization now uses `Math.max(demandBased, parBased)` instead of just `demandBased` — ensures sub-recipe items with their own par levels are never under-produced when parent demand is lower than the par deficit

**`GoogleDocsPrepSystem.gs` — Par/stock lines removed (deployed via clasp push):**
- `insertParStockLines_` and `appendParStockLines_` are now no-ops (function bodies emptied)
- Documents no longer show "Par Level", "Stock Counted", "Parent Ingredient", or "Required Parent Batch QTY" lines
- All 4 document types affected (Batching, Ingredient Prep, and both ordering docs)

**`GoogleDocsPrepSystem.gs` — "Additional Tasks" section added:**
- HEADING2 "Additional Tasks" + 10 blank lines appended after the feedback link on Batching and Ingredient Prep docs only (not ordering docs)
- Added across all 4 code paths: 2 doc types x template path + programmatic fallback path

**CLAUDE.md secrets scrubbed for GitHub push protection:**
- API keys (OpenAI, Anthropic, Airtable PAT, Recipe Sync Secret) replaced with `<see .env.local>` or `<stored in GAS Script Properties>` placeholders
- Applies to both `The Waratah/CLAUDE.md` and `Sakura House/CLAUDE.md`

**Git repository initialized:**
- Initial commit pushed to `https://github.com/thewaratah/pollenprepsystems.git`
- `.gitignore` excludes: `Reference/`, `node_modules/`, `.env*` files, `config/secrets` files, visual assets, RAG scripts, `.claude/` directory

**`GoogleDocsPrepSystem.gs` — Item header split into two lines (deployed via clasp push):**
- Item headers on Batching and Ingredient Prep sheets changed from single-line `"ItemName Qty (buffer)"` H1 to a two-line format:
  - Line 1 (H1): Item name only (e.g., "Espresso Martini Batch")
  - Line 2 (H2): `"To Make: Qty (buffer)"` (e.g., "To Make: 1000ml (1.5x = 1500ml)")
- Applied across all 10 code paths (5 template/insert + 5 programmatic/append)
- Sub-recipe and garnish items use H2 name + 12pt paragraph `"To Make:"` to preserve visual hierarchy under parent batch H1
- Bold/underline styling now applies to the base quantity on the `"To Make:"` line

**Key notes for future sessions:**
- `insertParStockLines_` and `appendParStockLines_` still exist as functions but are no-ops — do not re-add par/stock/parent lines without explicit instruction
- "Additional Tasks" section only appears on Batching and Ingredient Prep docs, never on ordering docs
- Item headers are two-line format: H1 name then H2 "To Make: qty" — do not merge back to single-line without explicit instruction
- Repo is now tracked at `https://github.com/thewaratah/pollenprepsystems.git`

---

### 2026-03-03 — Reference Directory Cleanup & GoogleDocsPrepSystem Breakdown Plan

**Root `Reference/` directory pruned to Claude + Airtable resources only:**
- Removed most `awesome-ai-system-prompts/` subdirectories (kept `Claude/` + `Claude-Code/` only)
- Removed most `system-prompts-and-models-of-ai-tools/` subdirectories (kept `Anthropic/` only)
- Removed non-Airtable `automation/awesome-n8n-templates/` categories (kept `Airtable/` only)
- Retained: `claude-tools/` (1.8GB), `claude-code-system-prompts/`, `plugin-prep-airtable/`

**`Sakura House/Reference/` also pruned:**
- Removed `integrations/`, `llm-patterns/`, `ohmyzsh/`, non-Airtable n8n templates
- Retained: `claude-tools/` (3.2GB), `automation/awesome-n8n-templates/Airtable/`

**`GoogleDocsPrepSystem.gs` breakdown plan created (not yet executed):**
- Plan saved at `The Waratah/docs/plans/GoogleDocsPrepSystem-breakdown-plan.md`
- Proposes splitting the 2685-line monolith into 5 files
- No code changes made — plan only

---

### 2026-03-03 — GDoc Formatting: Avenir Font, Method HEADING2, Name Field, Item Separators, Scaler Spacer

**`GoogleDocsPrepSystem.gs` (deployed via clasp push) — 5 formatting changes applied to both template/insert-index path and programmatic fallback path:**

- **Zero-spacing item separator** — blank paragraph with `setSpacingAfter(0)` / `setSpacingBefore(0)` appended at the end of `insertParStockLines_` and `appendParStockLines_`; creates a clean separator after each item block (heading + par/stock/parent lines)
- **Method label → HEADING2** — "Method:" label promoted from bold plain paragraph to `DocumentApp.ParagraphHeading.HEADING2` across 8 locations (4 insert + 4 append: Batching, Ingredient Prep flat, sub-recipe nested, Garnish/Other)
- **Scaler link spacer** — blank paragraph inserted between the `"📐 Scale this recipe"` link and the first ingredient bullet in all document sections (8 locations, both paths)
- **Avenir font** — `.setFontFamily("Avenir")` applied to all paragraphs, list items, and text runs inserted by the script — including `insertParStockLines_`, `appendParStockLines_`, `insertFeedbackLink_`, `appendFeedbackLink_`, and `appendTextWithBoldUnderline_`
- **"Name: _______" under subtitles** — plain paragraph `"Name: _______"` with Avenir font inserted after the SUBTITLE in `createOrReplaceBatchingDoc_` and `createOrReplaceIngredientPrepDoc_` only (not added to ordering docs)

---

### 2026-03-03 — Bug Fix: Required Parent Batch QTY in GoogleDocsPrepSystem.gs

**`GoogleDocsPrepSystem.gs` (deployed via clasp push):**
- `subRecipeItemIdToParentBatch` map enriched — now stores `{ names: string[], totalTargetQty: number }` per child item ID; `totalTargetQty` accumulates the sum of all parent batch `targetQty` values that require this sub-recipe ingredient (previously stored names only)
- Multi-tier nesting handled — code now walks each tier-1 sub-recipe's own recipe lines to link tier-2+ nested ingredients back to the same top-level batch's quantity
- Task enrichment now sets two fields: `task.parentBatchNames` (parent batch name(s)) and `task.parentBatchTargetQty` (sum of parent batch targetQty values — new field)
- `insertParStockLines_` and `appendParStockLines_` updated: label renamed `Required Parent Ingredient QTY` → `Required Parent Batch QTY`; value changed from `task.targetQty` (child qty — was wrong) → `task.parentBatchTargetQty` (parent batch total — correct)

**Production example (before → after):**
- Before: `Required Parent Ingredient QTY = 1292.30ml` (was child's own qty)
- After: `Required Parent Batch QTY = 5600ml` (correct parent batch total)

---

### 2026-03-03 — Project Cleanup: Deleted Stale Docs and Superseded Script

**Files deleted from `The Waratah/`:**
- `Waratah_GeneratePrepSheet.gs` — superseded by `Waratah_GeneratePrepSheet_TimeBasedPolling.gs`; removed from repo entirely
- `DEPLOYMENT-CHECKLIST.md`, `DEPLOYMENT-STATUS.md`, `AIRTABLE-SYNC-SETUP.md`, `VERCEL-DEPLOYMENT.md`, `WARATAH-TEMPLATE-GUIDE.md`, `WARATAH-SCRIPT-NAMING-GUIDE.md` — stale standalone docs, consolidated into CLAUDE.md or obsolete
- `WaratahVisualAssets/` directory — removed
- `docs/CLAUDE.md` (pre-split legacy), `docs/DIRECTORY-ANALYSIS.md` (archived), and all `docs/` guide files — cleaned up; `docs/archive/` retained
- `docs/guides/*.docx` — removed

**Files deleted from `Reference/`:**
- `Reference/claude-tools/claude-flow/v2/` (146 MB) and `v3/` (1.1 GB) — removed
- `Reference/automation/ohmyzsh/` — removed

**Docs updated this session:**
- `The Waratah/CLAUDE.md` — removed `WARATAH-SCRIPT-NAMING-GUIDE.md` link (deleted), removed `Waratah_GeneratePrepSheet.gs` from `.claspignore` example block and `clasp status` verification list
- `.claude/agents/waratah-prep-agent.md` — removed `Waratah_GeneratePrepSheet.gs` line from Codebase Structure tree

**Key note for future sessions:**
- `Waratah_GeneratePrepSheet.gs` no longer exists. The active export-trigger script is `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` only.
- The `.claspignore` file in `The Waratah/scripts/` still correctly excludes `Waratah_GeneratePrepSheet.gs` (harmless — ignoring a non-existent file does not cause errors).

---

### 2026-03-03 — Agent Instruction Enhancements (no system code changed)

**Agent files updated (`.claude/agents/*.md`):**
- `gas-code-review-agent.md` — added GAS runtime constraints (P0: no `fetch()`/`require()`), web app security rules, GAS tooling reference (gas-local, QUnitGS2, clasp-token-action, BetterLog)
- `rag-knowledge-agent.md` — added Hybrid Search Pattern, CRAG Pattern, Supabase MCP sections; pgvector index strategy (ivfflat vs hnsw) and chunk sizing guidance
- `knowledge-platform-agent.md` — added CRAG, Memory Persistence, Multi-MCP sections; system prompt quality checklist (injection defense, CoT, anti-patterns)
- `waratah-prep-agent.md` — added GAS web app patterns (`doGet`, param sanitization), library dependency fix reference
- `prep-orchestrator.md` — added SPARC Planning Protocol; agent concurrency rules / compatibility matrix
- `slack-ordering-agent.md` — added Block Kit builder section
- `recipe-scaler-agent.md` — added full web app entry point and deployment reference
- `documentation-agent.md` — added CLAUDE.md Health Check procedure
- `deployment-agent.md` — added CI/CD GitHub Actions reference (clasp-token-action)
- `airtable-mcp-agent.md` — **NEW agent created** for live Airtable data access via MCP2 server (33+ tools)

**Key note for future sessions:**
- All of the above are agent instruction files only — no GAS scripts, Next.js code, or Airtable automations were modified
- `airtable-mcp-agent` is now available for direct Airtable record queries via MCP; routing rule added to main CLAUDE.md

---

### 2026-03-03 (Part 2) — GAS File Analysis & Fixes: RecipeScaler, FeedbackForm, RecipeScalerUI

**`RecipeScaler.gs` (deployed via clasp push):**
- `getRecipeList()`: Now filters to active items only (`filterByFormula: '{Status}="Active"'`) — inactive items no longer appear in the recipe dropdown
- `getRecipeDetails()`: Added null-check guard for missing `baseId`/`pat` Script Properties
- `getRecipeDetails()`: Added `muteHttpExceptions: true` + HTTP response code check on recipe-by-ID fetch
- `getRecipeDetails()`: Removed `Recipe Name` plain-text field lookup — name now resolved exclusively via linked `Item Name` record (Waratah schema fix; `Recipe Name` does not exist in Waratah)

**`FeedbackForm.gs` (deployed via clasp push):**
- `searchRecipes()`: Completely rewritten to use `Item Name` linked-record two-step pattern — was broken (Waratah has no `Recipe Name` field, so autocomplete always returned empty)
- `sendFeedbackSlack_()`: Now posts to `SLACK_WEBHOOK_WARATAH_PREP` (with `SLACK_WEBHOOK_EV_TEST` fallback) — previously all production feedback went silently to the dev webhook
- Header comment corrected: `"Gooch, Sabs"` → `"Andie, Blade"`

**`RecipeScalerUI.html` (deployed via clasp push):**
- Added `escapeHtml()` helper; ingredient names/units from Airtable now escaped before `innerHTML` injection (XSS prevention)

**Outstanding — Airtable scripts still pending manual paste:**
- `Waratah_ClearWeeklyCount.gs` — Staff auto-fill "Blade", safeField_ P1-5 audit fix
- `Waratah_FinaliseCount.gs` — P0/P1 bug fixes
- `Waratah_GeneratePrepRun.gs` — Two-pass cascade, Garnish/Other, scope bug fix, P0/P1 fixes
- `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` — 14-day date guard

**Key Waratah pattern (note for future sessions):**
- `FeedbackForm.gs` recipe search requires the same two-step linked-record resolution as `RecipeScaler.gs`: fetch Items (Status=Active) → build id→name map → fetch Recipes → resolve name via `Item Name[0]` record ID

---

### 2026-03-03 — Bug Fixes: safeField_, Two-Pass Sub-Recipe Cascade, Garnish/Other, 14-Day Date Guard

**`Waratah_FinaliseCount.gs` (Airtable script, manual paste required):**
- P0: `getField()` → `safeField_()` for `Count Source` field (line ~534) — `getField()` throws on absent fields; `safeField_()` returns `null` safely
- Phase comment numbering aligned with console log numbering (P1 cosmetic)
- `writeAuditLog_()` timestamp field now uses `safeField_()` (P1-5)
- Added comment explaining dual-use of `itemNameField` / `recipeProducesItemField` (P1-6)

**`Waratah_GeneratePrepRun.gs` (Airtable script, manual paste required):**
- P0: `safeField_()` for buffer multiplier hoisted outside item loop — was re-evaluated per-item, risking null-throw mid-run
- P1-2: Two-pass sub-recipe cascade — accumulate all sub-recipe demands first, then finalise tasks; prevents under-production when a shared sub-recipe is demanded by multiple parent items
- P1-3: "REBUILD MODE" prefix removed from new run notes
- P1-5: `writeAuditLog_()` timestamp now uses `safeField_()`
- P1-7: `allowedTopLevelItemTypes` now includes `"Garnish"` and `"Other"` — these items appear on Ingredient Prep sheet (same as sub-recipes for prep purposes; never on ordering lists)

**`Waratah_ClearWeeklyCount.gs` (Airtable script, manual paste required):**
- P1-5: `writeAuditLog_()` timestamp now uses `safeField_()`

**`Waratah_GeneratePrepSheet_TimeBasedPolling.gs` (Airtable script, manual paste required):**
- P1-4: 14-day date guard added — only Prep Runs where `Prep Week` is within the last 14 days are eligible for export triggering; prevents historical re-exports
- Added `prepWeekField: "Prep Week"` and `maxAgeDays: 14` to CONFIG

**`GoogleDocsPrepSystem.gs` (deployed via clasp push):**
- P0: `body.clear()` → `body.clearContent()` in all 3 programmatic fallback doc generators — `clear()` destroys formatting and validations
- P0: Removed hardcoded Sakura base ID `appNsFRhuU47e9qlR` from reminder text in all 3 fallback generators
- `batchVariants: new Set(["Batch", "Sub Recipe"])` confirmed in `CFG.airtable.itemTypes` (was added 2026-02-26; retained)
- Garnish/Other items now route to Ingredient Prep List (added to `subRecipeTasks` dispatch)
- "Garnish & Other" section added to nested render model in both template and programmatic paths
- JSDoc example corrected: `"Gooch Ordering"` → `"Andie Ordering"`
- Ordering skip list: Garnish/Other excluded from all ordering docs (made in-house, not ordered)

**Key design decisions (note for future sessions):**
- Garnish and Other item types are treated identically to sub-recipes for prep purposes — they appear on the Ingredient Prep sheet and never on ordering sheets
- `allowedTopLevelItemTypes` in `Waratah_GeneratePrepRun.gs` is now: `new Set(["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"])`
- The two-pass cascade in `Waratah_GeneratePrepRun.gs` is intentional — do not revert to single-pass without understanding the shared sub-recipe demand accumulation requirement

---

### 2026-03-02 — Page Breaks, Run Sheet Naming, Slack Doc Links & Staff Auto-fill

**`GoogleDocsPrepSystem.gs` — Page breaks between items:**
- Added `PAGE_BREAK_BEFORE` attribute on each heading (items after the first) across all 6 loop locations (3 template/insert paths + 3 programmatic/append paths)
- `DocumentApp.Attribute.KEEP_WITH_NEXT` was attempted but is NOT valid in GAS (resolves to `undefined`, throws on `setAttributes`) — stripped 134 lines; `PAGE_BREAK_BEFORE` is the correct approach

**`GoogleDocsPrepSystem.gs` — Document title/file name format:**
- All 4 documents now include "W.E. DD/MM/YYYY" suffix based on `prepWeek + 6 days` (Monday run → Sunday week-end date)
- Base names changed from "List"/"Sheet" → "Run Sheet": `Ingredient Prep Run Sheet`, `Batching Run Sheet`, `Andie Ordering Run Sheet`, `Blade Ordering Run Sheet`
- New helper: `formatWeekEndingLabel_(run)` → `"W.E. DD/MM/YYYY"`

**`GoogleDocsPrepSystem.gs` — Slack notifications:**
- Removed folder link from all 3 channel messages (Prep / Andie / Blade)
- Andie + Blade channels now also receive Ingredient Prep + Batching links (previously only their own ordering doc)
- Slack link labels now use `doc.title` (includes W.E. date) instead of hardcoded strings

**`Waratah_ClearWeeklyCount.gs` — Staff auto-fill (Airtable script, manual paste required):**
- Added `countStaffField: "Staff"` and `countStaffDefaultValue: "Blade"` to CONFIG
- Placeholder records now include `Staff: { name: "Blade" }` (single-select) — uses `safeField_` check so it fails gracefully if field absent

---

### 2026-02-26 — Batch Item Support, Prep List Fixes & Recipe Scaler

**`Waratah_GeneratePrepRun.gs` — Batch items now generate Prep Tasks:**
- `allowedTopLevelItemType: "Sub Recipe"` → `allowedTopLevelItemTypes: new Set(["Batch", "Sub Recipe", "Sub-recipe"])` (subsequently extended to include `"Garnish"` and `"Other"` — see 2026-03-03)
- Previously, all "Batch" type items were silently skipped in Phase 9; now included
- Ingredient Requirements (ordering sheets) now reflect Batch recipe ingredient needs

**`Waratah_ClearWeeklyCount.gs` — Added `addMissingOnly` mode:**
- New `addMissingOnly: true` input: runs without deleting existing count records
- Only creates placeholders for items not already tracked (safe mid-week re-run)
- Also fixed: placeholders now correctly use `"Generated / Placeholder"` source (was wrongly using `"Stocktake (Verified)"`)

**`GoogleDocsPrepSystem.gs` — Three fixes:**
- `CFG.airtable.itemTypes.batch: "Sub Recipe"` → `batchVariants: new Set(["Batch", "Sub Recipe"])` — "Batch" items now appear in both Batching List and Ingredient Prep List docs
- Also updated ordering filter (`buildOrdering_`) to skip both "Batch" and "Sub Recipe" items (made in-house, not ordered)
- Added "📐 Scale this recipe" link in the flat model path of `createIngredientPrepDocFromTemplate_` (was missing; existed in Batching doc and programmatic fallback but not template Ingredient Prep List)

**`RecipeScaler.gs` — Fixed "Unknown" recipe names + active filter:**
- Waratah Recipes table has `"Item Name"` (linked record to Items) NOT a `"Recipe Name"` text field like Sakura
- `getRecipeList()` now: fetches all active Items (`{Status}="Active"`) → builds id→name map; fetches all Recipes (paginated); resolves name from linked item ID; filters out inactive recipes
- `getRecipeDetails()` now falls back to linked item name when `Recipe Name` field is absent
- **Deployment fix:** `RECIPE_SCALER_URL` was pointing to the Sakura web app deployment — Waratah GAS project now has its own web app deployment; script property updated

**Key Waratah schema difference from Sakura (Recipes table):**
- `"Item Name"` = the linked record field connecting Recipes → Items (returns array of record IDs via REST API)
- No separate `"Recipe Name"` text/formula field exists in Waratah's Recipes table
- `getRecipeList()` gets names via: fetch Items with Status=Active → map by ID → lookup from recipe's `Item Name` linked field

---

### 2026-02-20 — RAG Enrichment, UI Fixes & GAS Library Error

**Bibliography enrichment wired into RAG pipeline (`src/app/api/chat/route.ts`):**
- `searchKnowledge()` now calls `fetchBibliography()` after Supabase vector search
- Raw `file_name` from Supabase stored as `rawFilename` in chunk metadata (separate from display `filename`)
- Airtable lookup tries both `rawFilename` and `${rawFilename}.pdf` variants to handle extension mismatches
- `buildContext()` uses `bibliographicRef` if present; falls back to `title [category]` if not
- Dedup slice limit bumped 10 → 20

**`search_documents_by_topic` tool added to Super Agent:**
- Wired `searchDocumentsByTopic()` as a `streamText` tool
- Listed in system prompt so Claude knows to use it for topic/subject-area queries

**Recipe Scaler colour fix (`src/app/scaler/page.tsx`):**
- All `#8a8a8a` (light grey) replaced with `#2D3A16` (Waratah dark green) — replace_all
- Ingredient list `<li>` elements: added explicit `color: '#1a1a1a'` (were invisible — inherited global cream `--foreground: #E8EBE0` on white cards)
- Bullet dots: `bg-gray-400` → `backgroundColor: '#4A5D23'`
- Reset button border/text: `#e5e5e5/#8a8a8a` → `#2D3A16`

**Feedback form audit (`src/app/feedback/page.tsx` + `src/app/api/prep/feedback/route.ts`):**
- Subtitle colour `#8a8a8a` → `#2D3A16`
- Dropdowns confirmed clean: Andie/Blade ✅, no Sakura/Gooch/Sabs references ✅
- **Critical fix:** API route fallback base ID was `appNsFRhuU47e9qlR` (Sakura) → corrected to `appfcy14ZikhKZnRS` (Waratah)

**SlackBlockKit GAS library error fixed:**
- Error: "Library with identifier SlackBlockKit is missing" in both Sakura and Waratah GAS projects
- Cause: Library added in remote GAS editor previously; now deleted/inaccessible
- Fix: `clasp push --force` from both `scripts/` folders to overwrite remote `appsscript.json` with local `"dependencies": {}`
- Waratah: 7 files pushed; Sakura: 6 files pushed

**Key architecture note — light-mode pages on dark-mode global theme:**
- Global CSS sets `--foreground: #E8EBE0` (cream) on `body`
- Any page using white card UI (scaler, feedback, prep) must set `color: '#1a1a1a'` explicitly on all text
- Cannot rely on inheritance from CSS variables in these contexts

---

### 2026-02-20 — Knowledge Platform Launch & Branding Fixes

**Knowledge Platform deployed to Vercel:**
- URL: https://prep-knowledge-platform.vercel.app/?venue=waratah
- Vercel project: `thewaratahs-projects`
- Super Agent at `/api/chat` — Claude Sonnet 4 + RAG (Supabase pgvector) + 7 Airtable tools

**Airtable base ID corrected:**
- Was: `wspB1DzuXWuxEAhCD` (invalid)
- Fixed to: `appfcy14ZikhKZnRS`

**Branding purge (Sakura → Waratah):**
- Removed all `#2b3a8c` (Sakura blue) instances across the platform
- Replaced with `#4A5D23` (Waratah green) and `#2D3A16` (hover dark green)
- Fixed `api-venue.ts` default venue fallback: `'sakura'` → `'waratah'`

**Staff renamed (Gooch/Sabs → Andie/Blade):**
- Ordering filter in Knowledge Platform now shows Andie / Blade
- `ordering-list.ts` staff aliases updated
- `types/venue.ts` `slackWebhooks` keys updated: `andie` / `blade`
- Feedback form `docTypes` and `staffRoles` updated
- Super Agent tool descriptions updated
- Tests updated in `ordering-list.test.ts`

**Slack webhook env vars (Vercel + .env.local):**
- `SLACK_WEBHOOK_WARATAH_PREP` (General prep notifications)
- Note: `SLACK_WEBHOOK_WARATAH_ANDIE` and `SLACK_WEBHOOK_WARATAH_BLADE` removed in Phase 3 — combined ordering doc uses `SLACK_WEBHOOK_EV_TEST` (GAS Script Property, not Vercel env var)

---

## Development Commands

### Deploy Scripts to GAS

The `scripts/` folder is configured for Google Apps Script deployment using clasp.

**Configuration Files:**
- `.clasp.json` - Links to GAS project `10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8`
- `.claspignore` - Excludes Airtable scripts from GAS deployment
- `appsscript.json` - Apps Script manifest

**What Gets Deployed:**
- ✅ `GoogleDocsPrepSystem.gs` - Main export processor
- ✅ `FeedbackForm.gs` + `FeedbackFormUI.html` - Feedback system
- ✅ `RecipeScaler.gs` + `RecipeScalerUI.html` - Recipe scaler
- ❌ `Waratah_*.gs` - Excluded (Airtable-only)
- ❌ `*.py`, `*.sql`, `*.sh` - Excluded

**Deployment Commands:**

```bash
cd "THE WARATAH/scripts"

# Login to Google (first time or if token expired)
clasp login

# Push local changes to Google Apps Script
clasp push

# Force push (overwrite remote)
clasp push --force

# Pull remote changes to local
clasp pull

# Check tracked files
clasp status

# Open script in browser
clasp open
```

**⚠️ CRITICAL: Verify .claspignore Before Deploying**

Before running `clasp push`, always verify that `.claspignore` excludes all Airtable scripts:

```bash
# Check which files will be uploaded
clasp status

# Should NOT show:
# - Waratah_ClearWeeklyCount.gs
# - Waratah_FinaliseCount.gs
# - Waratah_GeneratePrepRun.gs
# - Waratah_GeneratePrepSheet_TimeBasedPolling.gs
# - Waratah_GenerateStockOrders.gs
# - Waratah_ExportOrderingDoc.gs
```

If Airtable scripts appear in `clasp status`, they will be uploaded to GAS and cause duplicate function name errors.

### Sync Scripts to Drive

After modifying any `Waratah_*.gs` or `GoogleDocsPrepSystem.gs` file, sync the .txt backups to Google Drive:

```bash
cd "The Waratah/scripts"
bash sync-airtable-scripts-to-drive.sh
```

This uploads the 4 Airtable-only scripts + `GoogleDocsPrepSystem.gs` as .txt files + a README to the [Script Backups](https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp) Drive folder. Uses the clasp OAuth token for authentication.

**This must be run after every change to Waratah scripts** — it is part of the deployment checklist.

### Test Locally

```bash
cd prep-knowledge-platform
NEXT_PUBLIC_VENUE_ID=waratah npm run dev
```

### Run RAG Ingestion

```bash
cd "THE WARATAH"
python3 rag-ingest-waratah.py
```

---

## Support

**Technical Issues:** Refer to [main CLAUDE.md](../CLAUDE.md)

**Waratah-Specific:** Contact venue manager or system administrator

---

*Last Updated: 2026-03-16*
