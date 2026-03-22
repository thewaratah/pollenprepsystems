# System Architecture Overview

**Last Updated:** 2026-03-22
**Audience:** Operations Manager maintaining The Waratah PREP system
**Venue:** The Waratah (bar staff, not kitchen)

---

## What This System Does

The Waratah PREP system automates the weekly bar stock count, ordering, and prep cycle. It connects three platforms:

1. **Airtable** -- the database where all items, recipes, stock counts, and prep data live
2. **Google Apps Script (GAS)** -- generates formatted Google Docs and sends Slack notifications
3. **Google Docs + Slack** -- the final outputs that bar staff use each week

The system replaces manual spreadsheet-based ordering and prep lists with a one-button pipeline: you count stock, press a button, and ordering docs and prep sheets appear in Slack within minutes.

---

## The Two-Script Architecture

This is the most important concept to understand. The system has **two completely separate execution environments** for its scripts:

### 1. Airtable Automation Scripts (run inside Airtable)

These scripts run directly within Airtable's automation engine. They manipulate Airtable data -- creating records, updating fields, deleting old records.

**All Airtable scripts have the `Waratah_` prefix:**

| Script | Purpose |
|--------|---------|
| `Waratah_InitStockCount.gs` | Creates a new Count Session and placeholder records for counting |
| `Waratah_CompleteStockCount.gs` | Button-triggered: marks session as "Completed" after counting |
| `Waratah_ValidateStockCount.gs` | Checks for uncounted items and outliers |
| `Waratah_GenerateStockOrders.gs` | Calculates order quantities from stock counts + prep usage |
| `Waratah_ExportOrderingDoc.gs` | Triggers ordering doc generation via GAS polling |
| `Waratah_ClearWeeklyCount.gs` | Resets Weekly Counts table for new prep cycle |
| `Waratah_FinaliseCount.gs` | Validates and finalises Weekly Counts stocktake |
| `Waratah_GeneratePrepRun.gs` | Calculates prep shortfalls and generates prep tasks |
| `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` | Marks Prep Runs for export (REQUESTED state) |

**Where to find them:** In the Airtable base, go to Automations. Each script is pasted into an "Run a script" action within its automation.

**How to edit them:** Open the automation in Airtable, click "Edit code" on the script action, paste updated code, and save.

### 2. Google Apps Script (run in GAS environment)

These scripts run in Google's cloud environment. They read data from Airtable via API, generate Google Docs, and send Slack messages.

| Script | Purpose |
|--------|---------|
| `GoogleDocsPrepSystem.gs` | Main document generator + Slack notifications + ordering export polling |
| `FeedbackForm.gs` + `FeedbackFormUI.html` | Staff feedback collection web app |
| `RecipeScaler.gs` + `RecipeScalerUI.html` | Recipe scaling calculator web app |

**Where to find them:** In the Google Apps Script editor. Open via `clasp open` from the terminal, or visit the GAS editor directly using Script ID `10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8`.

**How to edit them:** Either edit directly in the GAS web editor, or edit locally and deploy with `clasp push --force`.

---

## The .claspignore Rule (Critical)

The `Waratah_` prefixed scripts exist in the same local folder as the GAS scripts for version control purposes. However, they must NEVER be uploaded to the GAS project.

**Why:** Each Airtable script contains functions with identical names (`main()`, `formatSydneyTimestamp_()`, `safeField_()`). If two files with the same function name are uploaded to GAS, you get duplicate function errors and the entire GAS project breaks.

The `.claspignore` file prevents this by excluding all `Waratah_*.gs` files from `clasp push`. Before any deployment, always verify:

```bash
cd "The Waratah/scripts"
clasp status
# Verify NO Waratah_*.gs files appear in the output
```

If you see any `Waratah_` file listed in `clasp status` output, **stop and do not push**.

---

## How the Three Systems Connect

```
AIRTABLE (database + automations)
  |
  | Automations create/update records
  | (Count Sessions, Stock Counts, Stock Orders,
  |  Prep Runs, Prep Tasks, Ingredient Requirements)
  |
  | Sets "Export Request State" = REQUESTED (Prep Runs)
  | Sets "Ordering Export State" = REQUESTED (Count Sessions)
  |
  v
GOOGLE APPS SCRIPT (document generator)
  |
  | GAS time-trigger polls Airtable every 1-2 min
  | Finds REQUESTED records
  | Fetches data via Airtable REST API
  | Generates Google Docs using hybrid template engine
  | Sends Slack notifications
  | Sets state to COMPLETED
  |
  v
GOOGLE DOCS + SLACK (outputs)
  |
  | Bar staff receive Slack messages with doc links
  | Docs: Ingredient Prep List, Batching Run Sheet,
  |        Combined Ordering Run Sheet
```

---

## The Weekly Cycle

| When | What Happens | Script(s) |
|------|-------------|-----------|
| **Saturday AM** | Weekly Counts table cleared, new placeholders created | `Waratah_ClearWeeklyCount.gs` |
| **Sunday** | Physical stocktake -- staff count every prep item in Airtable Interface | Manual data entry |
| **Sunday 11pm** | Counts finalised, recipes validated | `Waratah_FinaliseCount.gs` |
| **Sunday 11:15pm** | Prep tasks generated from shortfalls | `Waratah_GeneratePrepRun.gs` |
| **Sunday 11:15pm** | Prep Run marked for export | `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` |
| **Within 5 min** | GAS polls, generates 2 prep docs, sends Slack | `GoogleDocsPrepSystem.gs` |
| **Monday AM** | Bar stock count (Core Order items) | `Waratah_InitStockCount.gs` (creates session) |
| **Monday** | Evan counts ~59 items across 5 areas | Manual data entry |
| **Monday** | Complete count, validate, generate orders | `CompleteStockCount` --> `ValidateStockCount` --> `GenerateStockOrders` |
| **Within 2 min** | GAS polls, generates ordering doc, sends Slack | `GoogleDocsPrepSystem.gs` |
| **Monday before 2pm** | Ordering completed using the ordering doc | Manual |
| **Tuesday** | Orders arrive | Deliveries |
| **Tuesday-Wednesday** | Prep tasks executed from prep docs | Manual |

---

## How to Access Each System

### Airtable Base

- **Base ID:** `appfcy14ZikhKZnRS`
- **URL:** Open Airtable and find "The Waratah" base
- **Key tables:** Items, Recipes, Recipe Lines, Weekly Counts, Par Levels, Prep Runs, Prep Tasks, Ingredient Requirements, Count Sessions, Stock Counts, Stock Orders, Audit Log

### Google Apps Script Editor

- **Script ID:** `10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8`
- **Open from terminal:** `cd "The Waratah/scripts" && clasp open`
- **Or:** Visit `https://script.google.com/d/10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8/edit`

### Script Properties

Script Properties are key-value pairs stored in the GAS project. They hold sensitive configuration like API keys, webhook URLs, and folder IDs. They are NOT in the code -- they are set separately.

**Where to find them:** GAS Editor --> Project Settings (gear icon) --> Script Properties

Key properties:

| Property | What It Does |
|----------|-------------|
| `AIRTABLE_BASE_ID` | The Waratah Airtable base ID (`appfcy14ZikhKZnRS`) |
| `AIRTABLE_PAT` | Personal Access Token for Airtable API calls |
| `DOCS_FOLDER_ID` | Google Drive folder where generated docs are saved |
| `SLACK_WEBHOOK_PREP` | Slack webhook for Monday AM prep doc notifications |
| `SLACK_WEBHOOK_WARATAH_TEST` | Slack webhook for ordering doc + test notifications |
| `SLACK_WEBHOOK_EV_TEST` | Dev fallback webhook |
| `MANUAL_TRIGGER_SECRET` | Secret key for authenticating manual webhook triggers |
| `WARATAH_TEMPLATE_BATCHING_ID` | Google Doc ID for Batching Run Sheet template |
| `WARATAH_TEMPLATE_INGREDIENT_PREP_ID` | Google Doc ID for Ingredient Prep List template |
| `WARATAH_TEMPLATE_ORDERING_ID` | Google Doc ID for Combined Ordering Run Sheet template |
| `FEEDBACK_FORM_URL` | Deployed URL for the Feedback Form web app |
| `RECIPE_SCALER_URL` | Deployed URL for the Recipe Scaler web app |
| `RECIPE_SYNC_SECRET` | Secret for recipe sync API calls |

### Google Drive Folders

| Folder | ID | Purpose |
|--------|----|---------|
| Base folder | `1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx` | Root folder for all generated docs |
| Templates | `1f4InQCmccjUSnpEqJzz1VnrtSfmweElU` | Template docs used by the generator |
| Script Backups | `1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp` | Drive backups of all scripts |

---

## Airtable Interfaces vs Raw Tables

Airtable has two ways to view data:

- **Raw tables:** The full database view with all fields. Used for administration and debugging.
- **Interfaces:** Custom views designed for bar staff. These show only the relevant fields in a user-friendly layout (e.g., the Stock Count interface shows only the tally columns for counting).

The scripts always work with the underlying tables, not the interfaces. Interfaces are a presentation layer only.

---

## What Each Document Type Is

| Document | Generated When | Contents | Who Uses It |
|----------|---------------|----------|-------------|
| **Ingredient Prep List** | Monday AM (automated) | Sub-recipe tasks grouped by their parent batch, with ingredients and quantities | Prep team |
| **Batching Run Sheet** | Monday AM (automated) | Batch tasks with ingredient bullets and method steps | Prep team |
| **Combined Ordering Run Sheet** | After stock count (polling) | Bar stock + prep ingredients grouped by supplier, with order quantities | Evan (ordering) |

---

## Next Steps

For detailed information about each script, see the individual script explainer files in this folder. For editing procedures, see `EDITING_GUIDE.md`. For end-to-end workflow diagrams, see `WORKFLOWS.md`.
