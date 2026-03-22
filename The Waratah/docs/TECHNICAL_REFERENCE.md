# The Waratah -- Technical Reference

**For:** Developers, system administrators, and anyone modifying or extending the system.

**Last Updated:** 2026-03-22

---

## Architecture Overview
*How data flows from Airtable through GAS to Google Docs and Slack.*

### User Interaction Layer

Staff and managers interact with the system through **Airtable Interfaces** -- purpose-built dashboards with buttons, forms, and filtered views. They never access raw tables directly. The trigger chain is:

```
Interface Button (user clicks)
    -> Airtable Automation (runs script)
        -> Script executes (reads/writes Airtable data)
            -> For exports: GAS polls for REQUESTED state -> Google Docs + Slack
```

Scheduled automations (ClearWeeklyCount, FinaliseCount, GeneratePrepRun, TimeBasedPolling) run on timers. Stock count scripts (InitStockCount, CompleteStockCount) are triggered by Interface buttons. ValidateStockCount and GenerateStockOrders fire automatically on status transitions.

### System Architecture

```
+-----------------------------------------------------------------------+
|                            AIRTABLE                                   |
|  +--------------+  +--------------+  +--------------+                 |
|  |    Items     |  |   Recipes    |  | Recipe Lines |                 |
|  +--------------+  +--------------+  +--------------+                 |
|  +--------------+  +--------------+  +--------------+                 |
|  | Par Levels   |  | Weekly Counts|  |  Prep Runs   |                 |
|  +--------------+  +--------------+  +--------------+                 |
|  +--------------+  +--------------+  +--------------+                 |
|  |  Prep Tasks  |  |Ingredient Req|  |   Supplier   |                 |
|  +--------------+  +--------------+  +--------------+                 |
|  +--------------+  +--------------+  +--------------+                 |
|  |Count Sessions|  | Stock Counts |  | Stock Orders |                 |
|  +--------------+  +--------------+  +--------------+                 |
|  +--------------+                                                     |
|  |  Audit Log   |                                                     |
|  +--------------+                                                     |
|                                                                       |
|  [Automations] ------------------------------------------------------ |
|  ClearWeeklyCount | FinaliseCount | GeneratePrepRun | TimeBasedPolling|
|  InitStockCount | CompleteStockCount | ValidateStockCount             |
|  GenerateStockOrders | ExportOrderingDoc                             |
+-----------------------------------------------------------------------+
                                |
                                | GAS polls for REQUESTED state
                                v
+-----------------------------------------------------------------------+
|                    GOOGLE APPS SCRIPT                                  |
|                                                                       |
|  GoogleDocsPrepSystem.gs                                              |
|  +-- doGet(e)                     -> Web app router                   |
|  +-- doPost(e)                    -> Manual trigger handler           |
|  +-- processPrepRunExportRequests_()  -> Monday AM prep docs          |
|  +-- processOrderingExportRequests()  -> Ordering doc polling         |
|                                                                       |
|  FeedbackForm.gs + FeedbackFormUI.html  -> Staff feedback web app     |
|  RecipeScaler.gs + RecipeScalerUI.html  -> Recipe scaling web app     |
+-----------------------------------------------------------------------+
                    |                          |
                    v                          v
       +-------------------+        +-------------------+
       |   GOOGLE DOCS     |        |      SLACK        |
       |                   |        |                   |
       | - Ingredient Prep |        | - Prep channel    |
       |   Run Sheet       |        | - Evan's channel  |
       | - Batching Run    |        |   (ordering)      |
       |   Sheet           |        | - Waratah Prep    |
       | - Combined        |        |   (feedback)      |
       |   Ordering Run    |        |                   |
       |   Sheet           |        |                   |
       +-------------------+        +-------------------+
```

---

## Two-Script Architecture
*Why Waratah scripts run in two separate environments and how they connect.*

The Waratah PREP system runs code in two distinct environments that cannot share functions or libraries:

### Airtable Automation Scripts (9 scripts)
*Scripts prefixed with `Waratah_` that run inside Airtable's automation engine.*

- Execute inside Airtable's JavaScript sandbox
- Access Airtable data via the `base` and `table` global objects
- Cannot use GAS APIs (DocumentApp, DriveApp, UrlFetchApp, etc.)
- Receive inputs via `input.config()` from automation configuration
- Report results via `output.set()` for downstream automation steps
- Each script has its own `main()`, `formatSydneyTimestamp_()`, `safeField_()` functions

### GAS Scripts (3 scripts)
*Scripts deployed to Google Apps Script via clasp.*

- Execute in Google's V8 Apps Script runtime
- Access Google services (Docs, Drive, Sheets) and external APIs via `UrlFetchApp`
- Read Airtable data via REST API with PAT authentication
- Deployed as a web app with `doGet`/`doPost` entry points

### The Connection
*How Airtable scripts communicate with GAS without direct function calls.*

The two environments communicate via **state fields** in Airtable, not webhooks:

1. Airtable script sets a status field (e.g., `Export Request State = "REQUESTED"`)
2. GAS time-driven trigger polls Airtable REST API every 1-2 minutes
3. GAS detects the REQUESTED state, processes the export, updates state to COMPLETED or ERROR

### Why .claspignore Is Critical (P0)

The `.claspignore` file prevents Airtable scripts from being uploaded to GAS during `clasp push`. Without it, duplicate function names (`main()`, `formatSydneyTimestamp_()`, `safeField_()`) across all 9 Airtable scripts would cause GAS compilation errors and break the entire deployment.

---

## Script Reference
*All 12 scripts, their versions, triggers, and key algorithms.*

### Location

All scripts: `The Waratah/scripts/`

### Script Versions

| Script | Version | Environment |
|--------|---------|-------------|
| `Waratah_ClearWeeklyCount.gs` | v2.0 | Airtable |
| `Waratah_FinaliseCount.gs` | v2.0 | Airtable |
| `Waratah_GeneratePrepRun.gs` | v2.2 | Airtable |
| `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` | v4.0 | Airtable |
| `Waratah_InitStockCount.gs` | v1.0 | Airtable |
| `Waratah_CompleteStockCount.gs` | v1.0 | Airtable |
| `Waratah_ValidateStockCount.gs` | v1.0 | Airtable |
| `Waratah_GenerateStockOrders.gs` | v1.0 | Airtable |
| `Waratah_ExportOrderingDoc.gs` | v1.0 | Airtable |
| `GoogleDocsPrepSystem.gs` | v4.2 | GAS |
| `RecipeScaler.gs` | v1.0 | GAS |
| `FeedbackForm.gs` | v1.0 | GAS |

---

### Airtable Automation Scripts

#### Waratah_ClearWeeklyCount.gs
*Resets the Weekly Counts table to prepare for a new stocktake cycle.*

**Version:** 2.0
**Trigger:** Saturday AM (scheduled automation)
**Inputs:** `includeInactive` (bool), `dryRun` (bool), `preserveVerifiedStocktakes` (bool), `addMissingOnly` (bool)

**Algorithm:**
```
1. Query all active items (Batch, Sub Recipe, Sub-recipe, Garnish, Other)
2. If addMissingOnly = false:
   a. Delete existing Weekly Count records (optionally preserve verified)
3. Build set of items already tracked (for addMissingOnly mode)
4. Create placeholder record for each item not already tracked
   - Staff field auto-filled to "Blade" (single-select)
   - Count Source = "Generated / Placeholder" (not "Stocktake (Verified)")
5. Log to Audit Log
```

**addMissingOnly Mode:** When `true`, skips deletion and only creates placeholders for items not already in Weekly Counts. Safe for mid-week re-runs.

---

#### Waratah_FinaliseCount.gs
*Validates and locks the Weekly Counts stocktake data.*

**Version:** 2.0
**Trigger:** Sunday 11pm (scheduled automation)
**Inputs:** `dryRun` (bool), `skipRecipeValidation` (bool)

**Algorithm:**
```
1. Query Weekly Counts where Confirmed = false
2. Validate each record:
   - Has valid Item link
   - Has Stock Count value
3. Optional recipe integrity validation:
   - Sub Recipe items have recipes
   - Recipe components exist
   - Yields defined
4. Set Confirmed = true on valid records
5. Set Count Source = "Stocktake (Verified)"
6. Log results to Audit Log
```

---

#### Waratah_GeneratePrepRun.gs
*Calculates shortfalls and generates Prep Tasks + Ingredient Requirements.*

**Version:** 2.2
**Trigger:** Sunday 11:15pm (15 minutes after FinaliseCount)
**Inputs:** `requestId` (string), `prepWeek` (date override), `dryRun` (bool), `allowDuplicates` (bool)

**Algorithm:**
```
1. Find latest verified stocktake (max Count Date where Confirmed = true)
2. Load Par Levels for all items
3. For each item in stocktake:
   a. Calculate shortfall = Par Level - Stock Count
   b. If shortfall > 0:
      - Find recipe that produces this item
      - Calculate batches = ceil(shortfall / recipe yield)
      - Create Prep Task record
4. TWO-PASS sub-recipe cascade:
   Pass 1: Accumulate all sub-recipe demands from parent items
   Pass 2: Finalise sub-recipe tasks using MAX(demandBased, parBased)
5. For each Prep Task, create Ingredient Requirement records
6. Group Ingredient Requirements by Supplier + Ordering Staff
7. Log to Audit Log
```

**Critical constants:**
```javascript
allowedTopLevelItemTypes: new Set(["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"])
```

All five item types are required -- each appears in Airtable data. Garnish and Other route to Ingredient Prep List only (never ordering docs).

**Two-Pass Cascade:** Prevents under-production when a shared sub-recipe is demanded by multiple parent items. Pass 1 accumulates all demand; Pass 2 uses `Math.max(demandBased, parBased)` to ensure sub-recipes with their own par levels are never under-produced.

---

#### Waratah_GeneratePrepSheet_TimeBasedPolling.gs
*Marks Prep Runs for export by setting Export Request State to REQUESTED.*

**Version:** 4.0
**Trigger:** Sunday 11:15pm (time-based, after GeneratePrepRun)
**Inputs:** None -- queries automatically

**Algorithm:**
```
1. Query Prep Runs where Export Request State is empty/null
2. Apply 14-day date guard: only runs where Prep Week is within last 14 days
3. For each eligible run:
   - Set Export Request State = "REQUESTED"
   - Set Export Requested At = current timestamp
4. GAS time-trigger picks up REQUESTED state and generates docs
```

**14-day guard:** Prevents accidental re-export of historical Prep Runs.

---

#### Waratah_InitStockCount.gs
*Creates a new Count Session and placeholder Stock Count records for bar stock counting.*

**Version:** 1.0
**Trigger:** Manual button or scheduled automation (Monday AM)
**Inputs:** `dryRun` (bool), `countedBy` (string, defaults "Evan")

**Algorithm:**
```
1. Create Count Session record (status = "Not Started")
2. Query Items where Core Order = true (~59 items)
3. Clean up ALL previous sessions' Stock Count + Stock Order records
   (sessions themselves kept for history)
4. Create one Stock Count placeholder per Core Order item
   - Linked to new session
   - All tally fields blank
5. Update session status to "In Progress"
6. Log to Audit Log
```

---

#### Waratah_CompleteStockCount.gs
*Advances an "In Progress" Count Session to "Completed" after pre-flight checks.*

**Version:** 1.0
**Trigger:** Manual button on Count Sessions interface
**Inputs:** `sessionId` (string, auto-detects latest), `dryRun` (bool)

**Algorithm:**
```
1. Find latest "In Progress" Count Session (or use provided sessionId)
2. Fetch all Stock Count records for this session
3. Pre-flight: check every record has Total On Hand populated
   - REFUSE to complete if any items have no tallies
4. Update session status: "In Progress" -> "Completed"
5. Log to Audit Log
6. Triggers ValidateStockCount automation (fires on status change)
```

---

#### Waratah_ValidateStockCount.gs
*Validates completed stock count data -- flags uncounted items and outliers.*

**Version:** 1.0
**Trigger:** Automation on Count Session status change to "Completed"
**Inputs:** `sessionId` (string, auto-detects latest "Completed"), `dryRun` (bool)

**Algorithm:**
```
1. Find latest "Completed" session
2. Fetch all Stock Count records for this session
3. Flag items where Total On Hand is null ("not counted" -- blocks validation)
4. Flag outliers vs previous counts (optional threshold)
5. If no blockers: set session status to "Validated"
   If blockers found: set status to "Needs Review"
6. Log to Audit Log
```

**Reads `Total On Hand` formula field** (sum of 5 area tallies), not the legacy `Quantity` field.

---

#### Waratah_GenerateStockOrders.gs
*Aggregates counts, looks up pars + prep usage, creates Stock Order records.*

**Version:** 1.0
**Trigger:** Runs after ValidateStockCount sets status to "Validated"
**Inputs:** `sessionId` (string, auto-detects latest "Validated"/"Orders Generated"), `dryRun` (bool)

**Algorithm:**
```
1. Find latest "Validated" or "Orders Generated" session
2. Phase 8 cleanup: delete existing Stock Orders for this session (idempotent)
3. Fetch Stock Counts for session
4. Fetch Par Levels for all items
5. Fetch latest Prep Run's Ingredient Requirements (for prep usage)
6. For each item:
   Service Shortfall = MAX(0, Par Qty - Total On Hand)
   Combined Order Qty = Service Shortfall + Prep Usage
7. Create Stock Order records (one per item)
8. Update session status to "Orders Generated"
9. Phase 10: set Ordering Export State = "REQUESTED" (auto-triggers doc export)
10. Log to Audit Log
```

**Idempotent:** Safe to re-run -- deletes existing orders before regenerating.

---

#### Waratah_ExportOrderingDoc.gs
*Manual re-trigger for ordering doc export.*

**Version:** 1.0
**Trigger:** Button press in Count Sessions interface
**Inputs:** None -- auto-detects latest "Orders Generated" session

**Algorithm:**
```
1. Find latest "Orders Generated" session
2. Guard: only marks sessions with correct status
3. Set Ordering Export State = "REQUESTED"
4. GAS polling picks up and generates the doc
```

Used as a manual re-trigger after clearing a COMPLETED state, or if the auto-trigger from GenerateStockOrders was missed.

---

### GAS Scripts

#### GoogleDocsPrepSystem.gs
*Main document export processor with hybrid template engine and Slack notifications.*

**Version:** 4.2
**Deployment:** Google Apps Script Web App
**Entry Points:**

| Function | Purpose | Trigger |
|----------|---------|---------|
| `doGet(e)` | Unified web app router | HTTP GET |
| `doPost(e)` | Manual trigger handler (`action=ordering`) | HTTP POST |
| `processPrepRunExportRequests_()` | Monday AM: 2 prep docs | GAS time-driven trigger |
| `processOrderingExportRequests()` | Ordering doc polling | GAS time-driven trigger (1-2 min) |

**Monday AM Export (2 docs):**
1. Ingredient Prep Run Sheet -- sub-recipe tasks grouped by parent batch
2. Batching Run Sheet -- batch tasks with ingredient bullets + method

**Ordering Export (1 doc, triggered separately):**
3. Combined Ordering Run Sheet -- bar stock orders + prep-only items, grouped by supplier

**Key CFG constants:**
```javascript
CFG.airtable.itemTypes.batchVariants: new Set(["Batch", "Sub Recipe"])
CFG.airtable.itemTypes.ingredientPrepOnly: new Set(["Garnish", "Other"])
CFG.bufferMultiplier: 1.5
```

---

#### RecipeScaler.gs
*Constraint-based recipe scaling web app for bar staff.*

**Version:** 1.0
**Deployment:** GAS Web App (via unified router: `?page=scaler`)

**Waratah-specific pattern -- two-step linked record name resolution:**
```
1. Fetch all active Items (filterByFormula: '{Status}="Active"') -> build id->name map
2. Fetch all Recipes (paginated)
3. Resolve recipe name from linked Item Name field: items[recipe.fields["Item Name"][0]]
4. Filter out recipes with inactive/missing items
```

The Waratah Recipes table has `"Item Name"` (linked record to Items), **not** a `"Recipe Name"` text field. Never reference `fields['Recipe Name']` in Waratah GAS code.

---

#### FeedbackForm.gs
*Staff feedback collection with AI triage and Slack notifications.*

**Version:** 1.0
**Deployment:** GAS Web App (via unified router: default page)

Uses the same two-step linked record name resolution as RecipeScaler for recipe search/autocomplete. Posts feedback notifications to `SLACK_WEBHOOK_WARATAH_PREP` (falls back to `SLACK_WEBHOOK_EV_TEST`).

---

## Stock Count Pipeline
*The complete stock counting flow from initialisation to ordering doc generation.*

### Pipeline Diagram

```
[Init Stock Count]
        |
        v
    Not Started -> In Progress
        |
   (Evan counts stock in Airtable Interface)
        |
        v
[Complete Stock Count] (button, pre-flight: all items have tallies)
        |
        v
    Completed
        |
        v (automatic)
[Validate Stock Count]
        |
        +----> Needs Review (blockers found)
        |
        v
    Validated
        |
        v (automatic)
[Generate Stock Orders] -> Orders Generated + Ordering Export State = REQUESTED
        |
        v (GAS polls every 1-2 min)
[GoogleDocsPrepSystem.gs processOrderingExportRequests()]
        |
        v
    Combined Ordering Run Sheet generated + Slack notification
    Ordering Export State = COMPLETED
```

### 5-Area Tally Model
*How bar stock is counted across five physical areas.*

Stock Count records have five number fields -- one per counting area:

| Column | Physical Locations Covered |
|--------|---------------------------|
| `Public Bar` | Under PB Station, PB Backbar, PB Fridge |
| `Terrace Bar` | Under TB Station, TB Backbar, TB Fridge |
| `Banquettes` | Banquettes, Freezer |
| `Cool Rooms` | Hallway, Keg Room, Cool Room |
| `Back Storage` | B1 |

**Architecture:** One Stock Count record per item per session (~59 records for Core Order items, not 59 x 5). Each record has 5 tally fields. Evan walks each area, entering counts in the corresponding column.

**`Total On Hand` formula:**
```
IF(OR({Public Bar},{Terrace Bar},{Banquettes},{Cool Rooms},{Back Storage}),
  ({Public Bar}+{Terrace Bar}+{Banquettes}+{Cool Rooms}+{Back Storage}),
  BLANK())
```

Returns BLANK() when all tallies are empty -- this distinguishes "not counted" from "counted, total is 0". Scripts read this field (not the legacy `Quantity` field).

### Ordering Formula
*How each item's order quantity is calculated.*

```
Counting Scope: Items where Core Order = true (~59 items)
                This is a subset of Bar Stock = true (~414 items)

Service Shortfall = MAX(0, Par Qty - Total On Hand)
Prep Usage        = SUM(Ingredient Requirements for this item from latest Prep Run)
Combined Order Qty = Service Shortfall + Prep Usage
```

---

## Prep Pipeline
*The prep generation flow from weekly reset to document export.*

### Weekly Flow

```
Saturday AM              Sunday                  Sunday 11pm
     |                      |                        |
     v                      v                        v
ClearWeeklyCount        Staff count             FinaliseCount
(scheduled:             stock in                (scheduled:
 reset counts,          Airtable                 validate, lock,
 create placeholders)   Interface                set Confirmed=true)
                                                     |
                                                     v
                                              Sunday 11:15pm
                                                     |
                                     +---------------+---------------+
                                     |                               |
                                     v                               v
                              GeneratePrepRun                TimeBasedPolling
                              (calculate shortfalls,         (mark runs as
                               create tasks + reqs)          REQUESTED)
                                                                     |
                                                                     v
                                                              GAS time-trigger
                                                                     |
                                                                     v
                                                          GoogleDocsPrepSystem.gs
                                                          processPrepRunExportRequests_()
                                                                     |
                                                     +---------------+---------------+
                                                     |                               |
                                                     v                               v
                                              Ingredient Prep              Batching Run Sheet
                                              Run Sheet                           |
                                                     |                            |
                                                     v                            v
                                                  Slack -> Prep channel
```

### Monday Ordering (Separate)

```
Monday AM: [Init Stock Count] -> Count stock -> [Complete] -> [Validate]
                                                                  |
                                                                  v
                                                        [Generate Stock Orders]
                                                                  |
                                                                  v
                                                      Ordering Export State = REQUESTED
                                                                  |
                                                                  v
                                                        GAS polls -> Ordering doc
                                                                  |
                                                                  v
                                                        Slack -> Evan's channel
```

---

## Hybrid Template Engine (v4.2)
*How Google Docs are generated from templates with dynamic content injection.*

### Template Structure

Templates provide branding (logo, styled headers). Code provides all dynamic content.

```
+-------------------------------------------+
|  [LOGO]                                   |
|  Ingredient Prep Run Sheet                |  <- From template
|  {{DATE}} -- {{RUN_LABEL}}                |
|  Name: _______                            |
+-------------------------------------------+
|  {{CONTENT}}                              |  <- Marker (removed)
|                                           |
|  [Dynamic content inserted here           |  <- From code
|   by insert/append functions]             |
|                                           |
|  Additional Tasks                         |  <- Appended by code
|  (10 blank lines)                         |
|                                           |
|  Feedback link                            |  <- Appended by code
|  Scaler link                              |
+-------------------------------------------+
```

### Placeholder Replacement

```javascript
body.replaceText('{{DATE}}', formattedDate);
body.replaceText('{{RUN_LABEL}}', runLabel);
body.replaceText('{{STAFF_NAME}}', staffName);

// Find {{CONTENT}} marker, remove it, insert content at that position
const contentMarker = body.findText('{{CONTENT}}');
```

### Fallback

If a template ID is not set in Script Properties or the template file is missing, GoogleDocsPrepSystem falls back to full programmatic document generation.

### Document Formatting

- **Font:** Avenir (applied to all paragraphs, list items, and text runs)
- **Item headers:** Two-line format -- H1 item name, then H2 "To Make: Qty (buffer)"
- **Sub-recipe headers:** H2 name + 12pt paragraph "To Make:" (preserves hierarchy under parent batch H1)
- **Page breaks:** `PAGE_BREAK_BEFORE` attribute between items (after the first)
- **Method:** HEADING2 style
- **"Name: _______":** Inserted after subtitle on prep docs only (not ordering)
- **Additional Tasks:** HEADING2 + 10 blank lines, appended after feedback link (prep docs only)
- **Buffer format:** `"1000ml (1.5x = 1500ml)"`

### Template IDs (Script Properties)

| Property | Document Type |
|----------|---------------|
| `WARATAH_TEMPLATE_BATCHING_ID` | Batching Run Sheet |
| `WARATAH_TEMPLATE_INGREDIENT_PREP_ID` | Ingredient Prep Run Sheet |
| `WARATAH_TEMPLATE_ORDERING_ID` | Combined Ordering Run Sheet |

Templates are stored in the Templates folder: `1f4InQCmccjUSnpEqJzz1VnrtSfmweElU`

---

## Ordering Doc Generation
*How the Combined Ordering Run Sheet is built from stock counts and prep data.*

### Data Sources

The ordering doc pulls from two tables:

1. **Stock Orders** -- bar stock items (Core Order = true), generated by `Waratah_GenerateStockOrders.gs`
2. **Ingredient Requirements** -- prep-only items (from the active Prep Run, where `Bar Stock = false`)

### Line Format

```
Item Name  |  Nx Bottles
```

- ml-based items: quantity converted from ml to bottles using the item's Order Volume field
- Other units (case, keg, each): displayed with their original unit label (e.g., "2x Cases")
- Bold styling applied to the quantity portion (e.g., "4x Bottles")

### Three Sections

1. **Supplier-grouped bar stock** -- Stock Orders grouped by supplier, alphabetical within each group
2. **No-supplier items** -- Bar stock items with no supplier assigned
3. **Prep-only items** -- Ingredient Requirements for items where `Bar Stock = false` (non-bar-stock ingredients needed for prep)

### Items Excluded from Ordering

- **Batch** and **Sub Recipe** items are always skipped -- they are made in-house, not ordered
- **Garnish** and **Other** items are excluded from all ordering docs (made in-house)

---

## Slack Integration
*Webhook routing for prep and ordering notifications.*

### Webhook Routing

| Script Property | Used For | Recipient |
|----------------|----------|-----------|
| `SLACK_WEBHOOK_PREP` | Monday AM prep doc links (Ingredient Prep + Batching) | Prep team channel |
| `SLACK_WEBHOOK_EV_TEST` | Combined Ordering doc link | Evan's channel |
| `SLACK_WEBHOOK_WARATAH_PREP` | Feedback form notifications | Waratah prep channel |
| `SLACK_WEBHOOK_WARATAH_TEST` | Test/dev notifications | Test channel |

### Notification Payloads

**Monday AM (prep docs):** Sends Ingredient Prep Run Sheet and Batching Run Sheet links to `SLACK_WEBHOOK_PREP`. Link labels include "W.E. DD/MM/YYYY" week-ending date.

**Ordering doc:** Sends Combined Ordering Run Sheet link to `SLACK_WEBHOOK_EV_TEST`. Triggered when GAS polling picks up a REQUESTED state from Count Sessions.

**Feedback:** Posts feedback submissions to `SLACK_WEBHOOK_WARATAH_PREP` (falls back to `SLACK_WEBHOOK_EV_TEST` if absent).

---

## Script Properties Reference
*All GAS Script Properties required for production.*

Configure in: Google Apps Script Editor -> Project Settings -> Script Properties

| Property | Description | Used By |
|----------|-------------|---------|
| `AIRTABLE_BASE_ID` | `appfcy14ZikhKZnRS` | All GAS scripts |
| `AIRTABLE_PAT` | Personal Access Token | All GAS scripts |
| `DOCS_FOLDER_ID` | Google Drive folder for generated docs (`1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx`) | GoogleDocsPrepSystem |
| `WARATAH_TEMPLATES_FOLDER_ID` | Templates folder (`1f4InQCmccjUSnpEqJzz1VnrtSfmweElU`) | GoogleDocsPrepSystem |
| `WARATAH_ARCHIVE_FOLDER_ID` | Archive folder (to be configured) | GoogleDocsPrepSystem |
| `WARATAH_TEMPLATE_BATCHING_ID` | Batching Run Sheet template doc ID | GoogleDocsPrepSystem |
| `WARATAH_TEMPLATE_INGREDIENT_PREP_ID` | Ingredient Prep Run Sheet template doc ID | GoogleDocsPrepSystem |
| `WARATAH_TEMPLATE_ORDERING_ID` | Combined Ordering Run Sheet template doc ID | GoogleDocsPrepSystem |
| `SLACK_WEBHOOK_PREP` | Prep team channel webhook | GoogleDocsPrepSystem |
| `SLACK_WEBHOOK_WARATAH_PREP` | Waratah prep channel (feedback posts) | FeedbackForm |
| `SLACK_WEBHOOK_WARATAH_TEST` | Test/dev channel webhook | GoogleDocsPrepSystem |
| `SLACK_WEBHOOK_EV_TEST` | Evan's channel + dev fallback | GoogleDocsPrepSystem, FeedbackForm |
| `MANUAL_TRIGGER_SECRET` | Webhook authentication for doPost | GoogleDocsPrepSystem |
| `RECIPE_SYNC_SECRET` | Recipe sync authentication | RecipeScaler |
| `FEEDBACK_FORM_URL` | Deployed web app URL | GoogleDocsPrepSystem (link in docs) |
| `RECIPE_SCALER_URL` | Deployed web app URL | GoogleDocsPrepSystem (link in docs) |

**Note:** `FEEDBACK_FORM_URL` and `RECIPE_SCALER_URL` point to the same deployment URL. The unified `doGet` router handles page selection via `?page=scaler` or `?page=feedback`.

---

## Deployment
*clasp commands, .claspignore verification, and web app deployment.*

### GAS Deployment via clasp

```bash
cd "The Waratah/scripts"

# Verify what will be uploaded (P0 check)
clasp status
# MUST NOT show any Waratah_*.gs files

# Push to GAS
clasp push --force

# Open in browser
clasp open
```

**GAS Script ID:** `10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8`

### .claspignore Contents

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

# Node.js migration scripts
setup/**

# Other excludes
.clasp.json
.claspignore
```

**Why this matters:** Each Airtable script defines `main()`, `formatSydneyTimestamp_()`, `safeField_()`. GAS cannot have multiple scripts with the same top-level function names. Uploading any `Waratah_*.gs` file breaks the entire GAS project.

### What Gets Deployed to GAS

| Deployed | File |
|----------|------|
| Yes | `GoogleDocsPrepSystem.gs` |
| Yes | `FeedbackForm.gs` + `FeedbackFormUI.html` |
| Yes | `RecipeScaler.gs` + `RecipeScalerUI.html` |
| Yes | `appsscript.json` |
| No | All `Waratah_*.gs` (Airtable-only) |
| No | `Debug.gs` (test only) |
| No | `*.py`, `*.sql`, `*.sh` |

### Web App Deployment

A single GAS deployment serves both web apps via a unified router:

```javascript
function doGet(e) {
  const page = (e.parameter.page || 'feedback').toLowerCase();
  if (page === 'scaler') return doGetRecipeScaler(e);
  else return doGetFeedback(e);
}
```

**URL routing:**
- `<deployment-url>` -> Feedback Form (default)
- `<deployment-url>?page=scaler` -> Recipe Scaler

**Deployment settings (in GAS editor):**
- Deploy -> New deployment -> Type: Web app
- Execute as: **Me**
- Who has access: **Anyone** (no Google login required for bar staff)

### Sync Scripts to Drive

After modifying any script file, sync backups to Google Drive:

```bash
cd "The Waratah/scripts"
bash sync-airtable-scripts-to-drive.sh
```

Uploads 9 Airtable scripts + `GoogleDocsPrepSystem.gs` as `.txt` files to the [Script Backups](https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp) Drive folder.

### Deploy Staff Docs to Drive

After updating any staff-facing documentation:

```bash
cd "The Waratah/docs"
node deploy-docs-to-drive.js
```

---

## Key Differences from Sakura House
*Schema, workflow, and staff differences between the two venues.*

| Feature | Sakura House | The Waratah |
|---------|--------------|-------------|
| **Airtable Base** | `appNsFRhuU47e9qlR` | `appfcy14ZikhKZnRS` |
| **GAS Script ID** | `1ALLTzQ44TDvekiQ...` | `10Ox7eE9-ReUCIpGR...` |
| **Recipe name field** | `Recipe Name` (plain text) | `Item Name` (linked record -> Items) |
| **Item types (GeneratePrepRun)** | Standard set | Extended: `Batch, Sub Recipe, Sub-recipe, Garnish, Other` |
| **Stock counting model** | Single count field per item | 5-area tally model (Public Bar, Terrace, Banquettes, Cool Rooms, Back Storage) |
| **Stock counting scope** | All active items | `Core Order = true` (~59 items) |
| **Ordering doc** | Split per staff (Gooch, Sabs) | Combined single doc (Evan) |
| **Ordering staff** | Gooch, Sabs | Evan (sole operator) |
| **Weekly cycle** | Fri AM clear -> Sat AM reset -> Sat shift | Sat AM clear -> Sun count -> Sun 11pm finalise -> Mon ordering |
| **Script prefix** | None | `Waratah_` for Airtable scripts |
| **`.claspignore` required** | Yes (simpler) | Yes (critical -- 9 Airtable scripts) |
| **Prep doc audience** | Kitchen staff | Bar staff |
| **Stock count tables** | Weekly Counts only | Count Sessions + Stock Counts + Stock Orders |
| **Ordering trigger** | Part of Monday AM export | Separate pipeline (Init -> Count -> Complete -> Validate -> Generate Orders -> Export) |

---

## Error Handling
*Retry logic, audit logging, and dry-run support across all scripts.*

### Audit Logging

All scripts (both Airtable and GAS) write to the **Audit Log** table with:
- Script name
- Timestamp (Sydney timezone)
- Action performed
- Record count / summary metrics
- Error details (if any)

### safeField_() Pattern

All Airtable scripts use `safeField_()` instead of direct `getField()` calls. `getField()` throws on absent fields; `safeField_()` returns `null` safely, preventing mid-run crashes when optional fields are missing.

```javascript
function safeField_(record, fieldName) {
  try { return record.getCellValue(fieldName); }
  catch (e) { return null; }
}
```

### Dry Run Mode

All Airtable scripts accept `dryRun: true` input. In dry run mode:
- All read operations execute normally
- All write operations are logged but not executed
- Audit Log entry marked as "DRY RUN"
- Safe for testing against production data

### Batch Operations

Airtable API limits: 10 records per create/update call, 50 records per delete call. All scripts batch their write operations accordingly.

### Rate Limiting

Airtable REST API: 5 requests per second per base. GAS scripts that make multiple Airtable calls (GoogleDocsPrepSystem, RecipeScaler) should respect this limit. The `Utilities.sleep(200)` pattern is used between sequential API calls.

### GAS Error Handling

- `processPrepRunExportRequests_()` and `processOrderingExportRequests()` catch all errors per-record and update the Airtable state field to ERROR
- Slack notifications are sent on failure via `SLACK_WEBHOOK_EV_TEST`
- `LockService.getScriptLock()` should be used on any function that can trigger simultaneously (P1 requirement)

---

## Known Issues & Pending Work
*Current limitations and planned improvements.*

### Legacy Data Cleanup

- **~17,800 old Stock Count records** from the previous item-x-location-x-session model need manual bulk deletion in Airtable UI. Scripts are already refactored to the one-record-per-item model; legacy data is inert but clutters the table.
- **3 aggregate Storage Location records** to remove (Public Bar, Terrace Bar, Backbars) -- remnants of the old location-breakdown model.

### Missing Data

- **5 Core Order items** missing `Location` multi-select values: 85% Ethanol, Appleton Estate Signature Blend, Archie Rose White Cane Rum, Dolin Dry, Margan Verjus, St Germain.

### Script Maintenance

- **`sync-airtable-scripts-to-drive.sh`** is missing `Waratah_ExportOrderingDoc.gs` from its AIRTABLE_SCRIPTS array -- needs adding.
- **GoogleDocsPrepSystem.gs refactor plan** exists at `The Waratah/docs/plans/GoogleDocsPrepSystem-breakdown-plan.md` -- proposes splitting the ~2685-line monolith into 5 files. Not yet executed.

### Planned Improvements

- Unit conversion: Par Levels stored in ml need conversion by Order Volume for display in bottles (see project memory for details)
- Archive folder (`WARATAH_ARCHIVE_FOLDER_ID`) not yet configured

---

## Related Documentation
*Links to companion guides and references.*

| Document | Audience | Purpose |
|----------|----------|---------|
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | All staff | Plain-English system overview |
| [PREP_SHEET_WEEKLY_COUNT_GUIDE.md](PREP_SHEET_WEEKLY_COUNT_GUIDE.md) | Bar staff | Weekly count and prep workflow |
| [STOCK_COUNT_ORDERING_GUIDE.md](STOCK_COUNT_ORDERING_GUIDE.md) | Bar staff | Stock counting and ordering process |
| [waratah-staff-guide.md](guides/waratah-staff-guide.md) | Bar staff | Quick-start staff guide |
| [CLAUDE.md](../CLAUDE.md) | Developers | Waratah system configuration and change log |
| [Main CLAUDE.md](../../CLAUDE.md) | Developers | Cross-venue navigation and agent routing |
