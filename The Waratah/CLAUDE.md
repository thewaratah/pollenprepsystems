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

**Help Docs (Google Drive):** https://drive.google.com/drive/folders/1-j2gtc1JJ93XueDQYmnJ9HdSkgPycrii

---

## Script Architecture

### Two-Script System

The Waratah PREP system uses a two-script architecture:

**1. Airtable Automation Scripts** (run INSIDE Airtable)
- `Waratah_ClearWeeklyCount.gs` - Reset weekly counts
- `Waratah_FinaliseCount.gs` - Validate stocktake
- `Waratah_GeneratePrepRun.gs` - Generate prep tasks
- `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` - Mark exports as REQUESTED
- `Waratah_InitStockCount.gs` - Initialize stock count session (create Count Session record + one Stock Count placeholder per Core Order item; cleans up all Stock Count & Stock Order records from previous sessions)
- `Waratah_ValidateStockCount.gs` - Validate stock count data before finalisation
- `Waratah_GenerateStockOrders.gs` - Generate stock orders from stocktake (writes to Stock Orders table; idempotent — deletes existing orders before regenerating; auto-sets Ordering Export State = REQUESTED to trigger doc export)
- `Waratah_CompleteStockCount.gs` - Button-triggered: advances "In Progress" session to "Completed" (pre-flight checks all items have tallies; triggers ValidateStockCount automation)
- `Waratah_ExportOrderingDoc.gs` - Trigger ordering doc export via GAS polling (sets "Ordering Export State" = REQUESTED on Count Sessions)

**2. Google Apps Script** (run in GAS environment, split into 5 files — all deploy as one namespace)
- `PrepConfig.gs` - CFG object + global override vars
- `PrepUtils.gs` - Airtable REST API, Drive helpers, pure utilities
- `PrepDocFormatting.gs` - Template engine v4.2 + formatting helpers
- `PrepDocGenerators.gs` - All doc generators (batching, ingredient prep, combined ordering)
- `GoogleDocsPrepSystem.gs` - Orchestrator + Slack + polling + healthCheck
- `FeedbackForm.gs` - Feedback collection backend
- `FeedbackFormUI.html` - Feedback form UI
- `RecipeScaler.gs` - Recipe scaling backend
- `RecipeScalerUI.html` - Recipe scaler UI

**Ordering Export Polling** (`processOrderingExportRequests()` in `GoogleDocsPrepSystem.gs`):
- Polls Count Sessions table for records where "Ordering Export State" = "REQUESTED", patches state to IN_PROGRESS before processing
- Calls `exportCombinedOrderingDoc_()` to generate the ordering doc
- Sets "Ordering Export State" to COMPLETED (success) or ERROR (failure)
- Requires a GAS time-driven trigger running every 1-2 minutes

**Airtable Tables/Fields for Stock Ordering:**
- **Count Sessions** table: "Ordering Export State" single-select field (options: REQUESTED, IN_PROGRESS, COMPLETED, ERROR)
- **Stock Orders** table: one record per item with supplier, qty, unit, linked to Count Session. `Waratah_GenerateStockOrders.gs` Phase 8 cleanup deletes existing orders before regenerating (idempotent re-runs). Accepts sessions with status "Validated" or "Orders Generated".

### Stock Count Data Model

**Scope:** Items with `Core Order = true` on the Items table (~59 items). This is a subset of `Bar Stock = true` (~414 items). `Core Order` is the canonical filter for counting scope.

**Architecture:** One Stock Count record per item per Count Session. Each record has **5 area tally fields** (number) + a **`Total On Hand` formula** that sums them. Evan enters per-area counts directly; the formula calculates the total.

**5 Counting Areas** (tally columns on Stock Counts):

| Column | Physical Locations Covered |
|--------|---------------------------|
| `Public Bar` | Under PB Station, PB Backbar, PB Fridge |
| `Terrace Bar` | Under TB Station, TB Backbar, TB Fridge |
| `Banquettes` | Banquettes, Freezer |
| `Cool Rooms` | Hallway, Keg Room, Cool Room |
| `Back Storage` | B1 |

**`Total On Hand` formula:** Returns BLANK() when all tallies are empty (distinguishes "not counted" from "counted, total is 0"). Scripts read this field instead of the legacy `Quantity` field.

**Stock Count Pipeline:**
1. `Waratah_InitStockCount.gs` → Creates Count Session + ~59 placeholder Stock Count records (one per Core Order item). Cleans up all Stock Count and Stock Order records from previous sessions (sessions themselves are kept for history).
2. Evan walks each area, enters counts in the corresponding tally column (all ~59 items visible in one sorted list)
3. `Waratah_CompleteStockCount.gs` → Button-triggered: pre-flight checks all items have tallies, advances status to "Completed"
4. `Waratah_ValidateStockCount.gs` → Flags uncounted items and outliers, sets status to "Validated" or "Needs Review"
5. `Waratah_GenerateStockOrders.gs` → Aggregates counts, looks up par levels + prep usage, creates Stock Order records, auto-sets `Ordering Export State = REQUESTED`
6. `GoogleDocsPrepSystem.gs` GAS polling → Picks up REQUESTED, generates Combined Ordering Run Sheet, sends Slack notification, sets COMPLETED

**Ordering formula per item:**
```
Service Shortfall = MAX(0, Par Qty - Total On Hand)
Combined Order Qty = Service Shortfall + Prep Usage (from latest Prep Run's Ingredient Requirements)
```

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
Waratah_CompleteStockCount.gs
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
| Initialize stock count | `Waratah_InitStockCount.gs` | Airtable |
| Complete stock count | `Waratah_CompleteStockCount.gs` | Airtable |
| Validate stock count | `Waratah_ValidateStockCount.gs` | Airtable |
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
# Airtable (used by GoogleDocsPrepSystem.gs, RecipeScaler.gs, FeedbackForm.gs)
AIRTABLE_BASE_ID=appfcy14ZikhKZnRS
AIRTABLE_PAT=<stored in GAS Script Properties>

# Google Drive
DOCS_FOLDER_ID=1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx
WARATAH_TEMPLATES_FOLDER_ID=1f4InQCmccjUSnpEqJzz1VnrtSfmweElU
WARATAH_ARCHIVE_FOLDER_ID=<TO_BE_CONFIGURED>

# Waratah Templates (Google Doc IDs)
WARATAH_TEMPLATE_BATCHING_ID=<google-doc-id>
WARATAH_TEMPLATE_INGREDIENT_PREP_ID=<google-doc-id>
WARATAH_TEMPLATE_ORDERING_ID=<google-doc-id>       # Combined ordering doc template (replaces per-staff Andie/Blade templates)

# Slack Webhooks
SLACK_WEBHOOK_PREP=<WEBHOOK_URL>             # Used by GoogleDocsPrepSystem.gs for Monday AM prep doc notifications
SLACK_WEBHOOK_WARATAH_PREP=<WEBHOOK_URL>     # Used by FeedbackForm.gs for production feedback posts; falls back to SLACK_WEBHOOK_EV_TEST if absent
SLACK_WEBHOOK_WARATAH_TEST=<WEBHOOK_URL>
SLACK_WEBHOOK_EV_TEST=<WEBHOOK_URL>          # Dev fallback for FeedbackForm.gs + combined ordering doc notifications

# Security
MANUAL_TRIGGER_SECRET=<GENERATE_RANDOM_SECRET>
RECIPE_SYNC_SECRET=<stored in GAS Script Properties>

# Web Apps (set after deployment)
FEEDBACK_FORM_URL=<DEPLOYED_WEB_APP_URL>
RECIPE_SCALER_URL=<DEPLOYED_WEB_APP_URL>
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
- Stock count: **Evan** (runs bar stock count, validates, triggers ordering pipeline)
- Ordering: **Andie** (alcohol + prep pantry suppliers), **Blade** (fruit & veg, prep pantry, pantry staples) — prep-sourced items appear in their own sections on the combined ordering doc
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

---

## Recent Changes


### 2026-03-23 — Security Hardening, Shared Utilities, Dead Code Removal, IN_PROGRESS State

**`GoogleDocsPrepSystem.gs` — Sanitized errors + IN_PROGRESS ordering state:**
- `doPost()` error response now returns `"Internal error"` instead of full error details (prevents information leakage)
- `processOrderingExportRequests()` now patches ordering export state to IN_PROGRESS before calling export function — prevents duplicate processing on slow exports

**`PrepUtils.gs` — New shared utilities:**
- `buildActiveItemNameMap_()` — fetches active Items from Airtable, returns `{recordId: name}` map for recipe name resolution
- `resolveRecipeName_()` — resolves recipe name from either text field or linked record, venue-agnostic
- `airtableFetchWithRetry_()` — automatic retry for Airtable REST calls: 429 (30s mandatory wait), 5xx (exponential backoff with jitter), 4xx (no retry). Now used by both `airtableGet_()` and `airtablePatch_()`

**`RecipeScaler.gs` — Refactored to use shared utilities:**
- `getRecipeDetails()` refactored to use `airtableGetByIds_()` and shared recipe name resolution via `resolveRecipeName_()` instead of raw `props.getProperty()` lookups

**`FeedbackForm.gs` — Refactored to use shared utilities:**
- `searchRecipes()` refactored to use `airtableGetByIds_()` and shared recipe name resolution instead of inline linked-record lookup

**`PrepDocGenerators.gs` — Dead fallback generators removed (-388 lines):**
- Deleted `createOrReplaceBatchingDoc_()` and `createOrReplaceIngredientPrepDoc_()` — these were programmatic fallback generators that duplicated template logic
- Wrapper functions now call template functions directly without try-catch fallback
- Templates are now required for all doc generation (no silent degradation to inferior formatting)

---

### 2026-03-22 — Ordering Doc: Removed "Order (Prep & Stock Count)" / "Order (Prep)" Prefixes

**`GoogleDocsPrepSystem.gs` — `exportCombinedOrderingDoc_()` updated:**
- Was: `Maidenii DRY Vermouth 750ml 16%  |  Order (Prep & Stock Count): 1x Bottles`
- Now: `Maidenii DRY Vermouth 750ml 16%  |  1x Bottles`
- Removed `"Order (Prep & Stock Count): "` prefix from bar stock order lines (supplier-grouped + no-supplier)
- Removed `"Order (Prep): "` prefix from all prep sections (Andie, Blade, prep-only, no-supplier within staff sections)
- Bold+underline styling still applies to the quantity portion (e.g., `1x Bottles`)
- All 7 line-format locations updated across `exportCombinedOrderingDoc_()` and `renderStaffPrepSection_()`

---

### 2026-03-22 — Andie's & Blade's Orders Sections in Combined Ordering Doc

**`GoogleDocsPrepSystem.gs` — `exportCombinedOrderingDoc_()` updated (deployed via clasp push):**
- Prep-only items from Ingredient Requirements are now split by `Ordering Staff (Static)` field into **Andie**, **Blade**, and **Other** buckets
- Items assigned to **Andie** appear in **"ANDIE'S ORDERS (from Prep Count)"** — supplier-grouped, bold+underline on quantities
- Items assigned to **Blade** appear in **"BLADE'S ORDERS (from Prep Count)"** — same format
- Items already in the stock count (Core Order / Bar Stock items) are automatically excluded from both sections — no double-ordering
- Remaining prep-only items (no staff assignment) stay in "PREP-ONLY ITEMS"
- All sections show quantity only (no `"Order (Prep)"` or `"Order (Prep & Stock Count)"` prefix)
- Refactored: shared `renderStaffPrepSection_()` and `buildSupplierGroups_()` helpers eliminate code duplication
- Slack notification: `X suppliers | Y Andie items | Z Blade items | W prep-only items`

**Ordering doc layout is now 6 sections:**
1. Supplier-grouped bar stock orders (from Stock Count)
2. ITEMS BELOW PAR — NO SUPPLIER (stock count items with no supplier)
3. ANDIE'S ORDERS (from Prep Count) — supplier-grouped
4. BLADE'S ORDERS (from Prep Count) — supplier-grouped
5. PREP-ONLY ITEMS (remaining unassigned prep items)
6. Empty state (if nothing to show)

**No Airtable changes required:**
- `Ordering Staff (Static)` field already exists on Ingredient Requirements and is populated by `Waratah_GeneratePrepRun.gs`

**Key note for future sessions:**
- Staff ordering sections are driven by `Ordering Staff (Static)` on Ingredient Requirements — to add a new staff member's section, extend the splitting logic and add a `renderStaffPrepSection_()` call
- The `orderingStaff` value is a lookup chain (Item → Supplier → Ordering Staff), consistent per item
- Items in the bar stock count (Core Order = true, Bar Stock = true) never appear in staff prep sections

---

### 2026-03-22 — Ordering Doc Line Format Simplified

**`GoogleDocsPrepSystem.gs` — Ordering doc output format changed (deployed via clasp push):**
- Was: `Item Name | On Hand: X | Par: Y | Prep: Z | Order: N`
- Now: `Item Name | Nx Bottles` (prefix labels subsequently removed — see 2026-03-22 entry above)
- Removed On Hand, Par, and Prep columns from ordering doc line items
- Unit display: ml-based items show "x Bottles" (converted), other units (case, keg) show their original unit label
- Applied to all ordering sections: supplier-grouped bar stock, no-supplier items, staff prep, and prep-only items
- Bold styling on the quantity portion preserved

**Key note for future sessions:**
- Ordering doc lines now show only item name and final order quantity — no prefix labels, no intermediate calculation columns

---

### 2026-03-21 — InitStockCount: Tally Field Migration + Phase 7 Rewrite

**`Waratah_InitStockCount.gs` — `countQuantityField` updated:**
- Changed from `"Quantity"` to `"Total On Hand"` — aligns with the tally fields migration (ValidateStockCount and GenerateStockOrders were already updated; InitStockCount was missed)

**`Waratah_InitStockCount.gs` — Phase 7 rewritten:**
- Was "Archive old sessions" (deleted sessions + their counts/orders older than 4 weeks; `archiveWeeks` config)
- Now "Clean up previous Stock Counts & Stock Orders" — deletes ALL Stock Count and Stock Order records from ALL previous sessions on every init run. Sessions themselves are kept for history.
- `archiveWeeks` config removed
- Session query now includes "Stock Orders" field (was missing, needed for cleanup)

**Key note for future sessions:**
- InitStockCount no longer archives/deletes sessions — it only deletes child records (Stock Counts + Stock Orders) from previous sessions
- There is no `archiveWeeks` config — cleanup is unconditional on every run

---

### 2026-03-21 — Auto-Export: GenerateStockOrders Now Triggers Ordering Doc

**`Waratah_GenerateStockOrders.gs` — Auto-triggers ordering doc export:**
- Phase 10 now sets `Ordering Export State = REQUESTED` alongside `Status = Orders Generated` in a single update
- Eliminates the need to manually press the "Export Ordering Doc" button after order generation
- GAS polling (`processOrderingExportRequests()`) picks up REQUESTED and generates the doc within 1-2 minutes
- `Waratah_ExportOrderingDoc.gs` remains available as a manual re-trigger if needed (e.g., after clearing COMPLETED state)

**Full one-button pipeline now:**
```
[Complete Stock Count] → Completed → [auto] ValidateStockCount → Validated
→ [auto] GenerateStockOrders → Orders Generated + REQUESTED
→ [GAS polls] → Doc generated + Slack notification
```

---

### 2026-03-21 — CompleteStockCount Button Script

**`Waratah_CompleteStockCount.gs` — New Airtable automation script:**
- Button-triggered script that advances "In Progress" Count Session to "Completed"
- Pre-flight guard: checks all Stock Count records have `Total On Hand` populated (refuses to complete if any items have no tallies)
- Triggers the existing `ValidateStockCount` automation (which fires on Status → "Completed")
- Follows existing script patterns: CONFIG, helpers, audit log, output.set()

**`.claspignore` updated:**
- Added `Waratah_CompleteStockCount.gs` to exclusion list

**Airtable setup required:**
- Create a button field or automation on Count Sessions to run this script
- Script auto-detects the latest "In Progress" session (no input required)

---

### 2026-03-21 — Stock Count Location Tally Fields (5-Area Model)

**Stock Counts table — 5 new number fields + formula:**
- Added `Public Bar`, `Terrace Bar`, `Banquettes`, `Cool Rooms`, `Back Storage` (number, 1dp) — one per counting area
- `Total On Hand` formula field to be added in Airtable UI: `IF(OR({Public Bar},{Terrace Bar},{Banquettes},{Cool Rooms},{Back Storage}), ({Public Bar}+{Terrace Bar}+{Banquettes}+{Cool Rooms}+{Back Storage}), BLANK())`
- Returns BLANK() when all tallies empty (preserves "not counted" detection)

**`Waratah_ValidateStockCount.gs` — Updated for formula field:**
- `countQuantityField` changed from `"Quantity"` to `"Total On Hand"`
- Removed auto-fill-to-zero logic (can't write to formula fields)
- Renamed `autoFilledZero` tracking to `notCounted` — items with null `Total On Hand` are flagged as "not counted" and block validation
- Removed `countLocationField` from query (no longer used)

**`Waratah_GenerateStockOrders.gs` — Updated:**
- `countQuantityField` changed from `"Quantity"` to `"Total On Hand"`

**Manual step required:**
- Create `Total On Hand` formula field in Airtable UI (MCP API doesn't support formula field creation)
- Configure "Stock Count" view: filter by session status "In Progress", sort by Item Name A-Z, show tally columns + Total On Hand + Previous Count

---

### 2026-03-21 — Stock Count Schema Audit & Documentation

**Stock Count data model documented:**
- `Core Order = true` confirmed as the canonical counting scope filter (~59 items), not `Bar Stock` alone (~414 items)
- One Stock Count record per item per session — no location dimension in records
- Location info lives on Items multi-select (12 physical locations) for view grouping only
- Stock Count pipeline fully documented: Init → Count → Validate → Generate Orders → Export Ordering Doc

**Schema findings:**
- Items table has dual location systems: `Location` multi-select (12 choices, canonical) and `Storage Location` linked records (redundant)
- Storage Locations table has 15 records — 3 are aggregates to be removed (Public Bar, Terrace Bar, Backbars)
- Stock Counts table had 17,874 legacy records from old item×location×session model — scripts already refactored to one-record-per-item model; legacy data needs manual cleanup in Airtable UI
- 5 Core Order items missing `Location` multi-select values: 85% Ethanol, Appleton Estate Signature Blend, Archie Rose White Cane Rum, Dolin Dry, Margan Verjus, St Germain

**Staff section updated:**
- Ordering staff changed from "Andie, Blade" to "Evan (sole operator)" — reflects combined ordering doc system

---

### 2026-03-21 — Project Restructuring: Airtable + GAS + Google Docs + Slack Only

**System scope reduced — Knowledge Platform, Supabase RAG, and Reference directories removed:**
- Deleted `prep-knowledge-platform/` (Next.js/Vercel app), `Reference/` directory, Python RAG scripts, SQL schema files, Supabase docs
- Deleted `The Waratah/.claude/` (SuperClaude framework with hardcoded API keys)
- System is now Airtable + GAS + Google Docs + Slack only — no Next.js, no Vercel, no Supabase
- Project size reduced from 6.5GB to 349MB

**Agents cleaned and enhanced:**
- Deleted `knowledge-platform-agent` and `rag-knowledge-agent` (no longer applicable)
- All remaining agents scrubbed of Vercel/Supabase/RAG references
- `airtable-mcp-agent` enhanced with operational workflows
- `slack-ordering-agent` enhanced with Slack MCP inspection
- New `/audit` command added for cross-venue Airtable schema comparison

**Key note for future sessions:**
- There is no Knowledge Platform, Supabase, or RAG pipeline — do not attempt to deploy or reference these components
- All historical Recent Changes entries referencing removed systems are annotated with "(System removed 2026-03-21)"

---

### 2026-03-21 — Documentation Sync: Stock Ordering Scripts + Script Properties Fix

**`CLAUDE.md` — Script Architecture section updated:**
- Added `Waratah_InitStockCount.gs` and `Waratah_ValidateStockCount.gs` to Airtable Automation Scripts list and Script Naming Convention table
- Added both scripts to `clasp status` verification checklist
- Updated sync-to-Drive description: "4 Airtable-only scripts" corrected to "7"

**`CLAUDE.md` — Script Properties section corrected (P1 accuracy fix):**
- `WARATAH_AIRTABLE_BASE_ID` corrected to `AIRTABLE_BASE_ID` (matches GAS code)
- `WARATAH_DOCS_FOLDER_ID` corrected to `DOCS_FOLDER_ID` (matches GAS code)
- `WARATAH_FEEDBACK_FORM_URL` corrected to `FEEDBACK_FORM_URL` (matches GAS code)
- `WARATAH_RECIPE_SCALER_URL` corrected to `RECIPE_SCALER_URL` (matches GAS code)
- Added `SLACK_WEBHOOK_PREP` (used by GoogleDocsPrepSystem.gs for Monday AM notifications; was undocumented)
- Clarified which script uses each Slack webhook property

**Key note for future sessions:**
- `sync-airtable-scripts-to-drive.sh` is missing `Waratah_ExportOrderingDoc.gs` from its AIRTABLE_SCRIPTS array — flag for next code session
- Stock ordering plan at `The Waratah/plans/stock-count-ordering-plan.md` — reference document, not a CLAUDE.md section

---

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
- **"Name: _______" under subtitles** — plain paragraph `"Name: _______"` with Avenir font inserted after the SUBTITLE in `createBatchingDocFromTemplate_` and `createIngredientPrepDocFromTemplate_` only (not added to ordering docs)

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

**(System removed 2026-03-21)** **Bibliography enrichment wired into RAG pipeline (`src/app/api/chat/route.ts`):**
- `searchKnowledge()` now calls `fetchBibliography()` after Supabase vector search
- Raw `file_name` from Supabase stored as `rawFilename` in chunk metadata (separate from display `filename`)
- Airtable lookup tries both `rawFilename` and `${rawFilename}.pdf` variants to handle extension mismatches
- `buildContext()` uses `bibliographicRef` if present; falls back to `title [category]` if not
- Dedup slice limit bumped 10 → 20

**(System removed 2026-03-21)** **`search_documents_by_topic` tool added to Super Agent:**
- Wired `searchDocumentsByTopic()` as a `streamText` tool
- Listed in system prompt so Claude knows to use it for topic/subject-area queries

**(System removed 2026-03-21)** **Recipe Scaler colour fix (`src/app/scaler/page.tsx`):**
- All `#8a8a8a` (light grey) replaced with `#2D3A16` (Waratah dark green) — replace_all
- Ingredient list `<li>` elements: added explicit `color: '#1a1a1a'` (were invisible — inherited global cream `--foreground: #E8EBE0` on white cards)
- Bullet dots: `bg-gray-400` → `backgroundColor: '#4A5D23'`
- Reset button border/text: `#e5e5e5/#8a8a8a` → `#2D3A16`

**(System removed 2026-03-21)** **Feedback form audit (`src/app/feedback/page.tsx` + `src/app/api/prep/feedback/route.ts`):**
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

**(System removed 2026-03-21)** **Knowledge Platform deployed to Vercel:**
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

**What Gets Deployed (10 files):**
- ✅ `PrepConfig.gs` - CFG object + globals
- ✅ `PrepUtils.gs` - Airtable REST, Drive helpers, utilities
- ✅ `PrepDocFormatting.gs` - Template engine + formatting
- ✅ `PrepDocGenerators.gs` - All doc generators
- ✅ `GoogleDocsPrepSystem.gs` - Orchestrator + Slack + polling + healthCheck
- ✅ `FeedbackForm.gs` + `FeedbackFormUI.html` - Feedback system
- ✅ `RecipeScaler.gs` + `RecipeScalerUI.html` - Recipe scaler
- ❌ `Waratah_*.gs` - Excluded (Airtable-only)
- ❌ `Debug.gs`, `*.py`, `*.sql`, `*.sh` - Excluded

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
# - Waratah_InitStockCount.gs
# - Waratah_ValidateStockCount.gs
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

This uploads the 7 Airtable-only scripts + `GoogleDocsPrepSystem.gs` as .txt files + a README to the [Script Backups](https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp) Drive folder. Uses the clasp OAuth token for authentication.

**This must be run after every change to Waratah scripts** — it is part of the deployment checklist.

---

## Documentation
*Staff guides, technical references, and schema docs — all synced to Google Drive as Google Docs.*

| Document | Audience | Purpose |
|----------|----------|---------|
| [SYSTEM_OVERVIEW.md](docs/SYSTEM_OVERVIEW.md) | All staff | System overview, weekly cycle, what you'll get each week |
| [PREP_SHEET_WEEKLY_COUNT_GUIDE.md](docs/PREP_SHEET_WEEKLY_COUNT_GUIDE.md) | Bar staff | How to read prep docs, Recipe Scaler, feedback |
| [STOCK_COUNT_ORDERING_GUIDE.md](docs/STOCK_COUNT_ORDERING_GUIDE.md) | Evan, management | Stock counting, ordering pipeline, formula, troubleshooting |
| [TECHNICAL_REFERENCE.md](docs/TECHNICAL_REFERENCE.md) | Developers | Script internals, algorithms, deployment, config |
| [AIRTABLE_SCHEMA.md](docs/AIRTABLE_SCHEMA.md) | Developers | Complete Airtable base schema (15 tables) |

**Google Drive (Help Docs):** https://drive.google.com/drive/folders/1-j2gtc1JJ93XueDQYmnJ9HdSkgPycrii

### Deploy Staff Docs to Google Drive

Run after updating any documentation to sync markdown → Google Docs:

```bash
cd "The Waratah/docs"
node deploy-docs-to-drive.js
```

Converts all 5 docs to `.docx` and uploads/overwrites them in the shared Google Drive Help Docs folder. Uses service account `claude-sheets-access@quick-asset-465310-h5.iam.gserviceaccount.com`.

### Google Workspace MCP & `gws` CLI

For ad-hoc Drive/Docs operations (verifying doc content, listing folder contents, checking template IDs), two tools are available in addition to `deploy-docs-to-drive.js`:

- **Google Workspace MCP** — configured in `.mcp.json` at project root. Claude can read/write Google Docs, Drive, and Sheets directly via MCP protocol.
- **`gws` CLI** (v0.18.1) — terminal CLI for Google Workspace APIs. Example: `gws drive files list --params '{"q": "'\''<folder-id>'\'' in parents"}'`

Both authenticate as `evan@pollenhospitality.com`. See root `CLAUDE.md` "External Tooling" section for full details.

---

## Support

**Technical Issues:** Refer to [main CLAUDE.md](../CLAUDE.md)

**Waratah-Specific:** Contact venue manager or system administrator

---

*Last Updated: 2026-03-23*
