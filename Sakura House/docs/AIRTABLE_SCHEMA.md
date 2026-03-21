# Sakura House — Airtable Schema Reference

**Base ID:** `appNsFRhuU47e9qlR`
**Last Updated:** 2026-03-21
**Source:** Live Airtable MCP query + GAS script field mappings

---

> **How users access this data:** Staff and managers interact with the PREP system through **Airtable Interfaces** — purpose-built dashboards with buttons, forms, and filtered views. The tables documented below are the **underlying data layer**. Only admins access raw tables directly (for adding items, suppliers, recipes, and troubleshooting). All weekly-cycle actions (counting stock, finalising, generating prep runs, exporting) are performed via Interface buttons.

---

## Table of Contents

1. [Items](#1-items)
2. [Supplier](#2-supplier)
3. [Recipes](#3-recipes)
4. [Recipe Lines](#4-recipe-lines)
5. [Par Levels](#5-par-levels)
6. [Weekly Counts](#6-weekly-counts)
7. [Prep Runs](#7-prep-runs)
8. [Prep Tasks](#8-prep-tasks)
9. [Ingredient Requirements](#9-ingredient-requirements)
10. [Handovers](#10-handovers)
11. [Recipe Database](#11-recipe-database)
12. [Prep Run Requests](#12-prep-run-requests)
13. [Staff Shift Logs](#13-staff-shift-logs)
14. [Audit Log](#14-audit-log)
15. [Feedback](#15-feedback)
16. [ADMIN CONTROLS](#16-admin-controls)
17. [Table Relationships](#table-relationships)
18. [Script Field Mappings](#script-field-mappings)
19. [Weekly Cycle Workflow](#weekly-cycle-workflow)

---

## 1. Items

**Table ID:** `tblMiIJW5c1yaKATc`
**Primary Field:** Item Name
**Purpose:** Master list of all ingredients, batches, sub-recipes, and garnishes managed by the PREP system.

| Field | Type | Details |
|-------|------|---------|
| **Item Name** | singleLineText | Primary field. Plain text name (NOT a linked record — contrast with Waratah which uses linked `Item Name`). |
| **Menu Category** | multipleSelects | Sour, Highball, Classics, Non Alcoholic, House Ingredients |
| **Cocktail Batch** | multipleSelects | Ehime, Nagano, Tochigi, Sakura Sour, House Highball, Bamboo, Mule, Daisy, Martini, Swizzle, Fizz, Old Fash, Negroni, Fukoka, House Blend, House Syrup, Garnish, Ice, Amazake, Bees Knees |
| **Supplier** | multipleRecordLinks | → Supplier table |
| **Item Type** | singleSelect | **Batch**, **Sub Recipe**, **Ingredient**, **Garnish**, **Other**, Sub-recipe, in |
| **Made or Purchased** | singleSelect | Made, Purchased |
| **Unit** | singleSelect | ml, g, each |
| **Order Size** | number | Standard order quantity from supplier |
| **Active** | checkbox | Whether item is currently in use |
| **Supplier Name** | multipleLookupValues | Lookup from Supplier → Supplier Name |
| **Product Category** | multipleLookupValues | Lookup from Supplier → Product Category |
| **Ordering Staff** | multipleLookupValues | Lookup from Supplier → Ordering Staff |
| **Weekly Volume (ml)** | number | Expected weekly consumption. Used by v3.0 reorder point calculation. |
| **Reorder Point (ml)** | formula | `Weekly Volume (ml) * 1.05 / 1.10` — dynamic threshold below which prep is triggered |
| **Trigger %** | formula | Ratio of stock to reorder point |
| **UI Name** | aiText | AI-formatted display name (capitalised, without bracket codes, with batch prefix) |
| **Item ID** | autoNumber | Internal auto-incrementing ID |
| **Notes** | richText | Free-form notes |
| **Recipes** | multipleRecordLinks | → Recipes table |
| **Recipe Lines** | multipleRecordLinks | → Recipe Lines table |
| **Par Levels** | multipleRecordLinks | → Par Levels table |
| **Weekly Counts** | multipleRecordLinks | → Weekly Counts table |
| **Prep Tasks** | multipleRecordLinks | → Prep Tasks table |
| **Ingredient Requirements** | multipleRecordLinks | → Ingredient Requirements table |
| **Max Storage (ml)** | multipleLookupValues | Lookup (source TBC) |
| **Buffer Multiplier** | number | Per-item override for the 1.5x default buffer (e.g. 2.0 for high-demand items) |
| **Feedback** | multipleRecordLinks | → Feedback table |

### Item Type values used by scripts

- **ClearWeeklyCount.gs:** `["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]` — all types that get placeholder rows
- **GeneratePrepRun.gs:** `"Batch"` + `["Sub Recipe", "Sub-recipe"]` — types that trigger prep tasks
- **GoogleDocsPrepSystem.gs:** `"Batch"` and `Set(["Sub Recipe", "Sub-recipe"])` — types that appear in prep docs

---

## 2. Supplier

**Table ID:** `tblSOucoAqhDTI2j4`
**Primary Field:** Supplier Name
**Purpose:** Supplier directory with ordering staff assignments and product categories.

| Field | Type | Details |
|-------|------|---------|
| **Supplier Name** | singleLineText | Primary field |
| **Email** | email | Supplier contact email |
| **Product Category** | singleSelect | Alcohol, Prep Ingredients, Fruit & Veg, Prep Pantry, General, Pantry Staples, Hardware, Maintenance, Stationary, Travel, NEEDS FIXING, Dry Goods, 86, In House Prep, Unimportant |
| **Ordering Staff** | singleSelect | **Gooch**, **Sabs**, Tom, Ev, Other |
| **Items** | multipleRecordLinks | → Items table (reverse link) |
| **Ingredient Requirements** | singleLineText | Legacy text field |
| **Ingredient Requirements 2** | multipleLookupValues | Lookup from Items → Ingredient Requirements |
| **Contact Details (AI)** | aiText | AI-generated contact summary |

### Ordering staff routing

The `Ordering Staff` field on Supplier determines which ordering list a supplier's items appear on:
- **Gooch** → Gooch Ordering List doc
- **Sabs** / **Sabine** → Sabs Ordering List doc
- Matching is case-insensitive via `CFG.airtable.staffAliases` in `GoogleDocsPrepSystem.gs`

---

## 3. Recipes

**Table ID:** `tblIuwtYka7LIaegW`
**Primary Field:** Recipe ID (autoNumber)
**Purpose:** Recipes that produce Items. Each recipe links to one Item and has multiple Recipe Lines (ingredients).

| Field | Type | Details |
|-------|------|---------|
| **Recipe ID** | autoNumber | Primary field (auto-incrementing) |
| **UI Name (from Item Name)** | multipleLookupValues | Lookup from Item Name → UI Name |
| **Tier** | singleSelect | 1, 2, 3, 4, 5, 6 |
| **Yield Qty** | number | How much one batch produces (in the item's unit) |
| **Unit** | multipleLookupValues | Lookup from Item Name → Unit |
| **Method** | richText | Step-by-step preparation method (included in Batching List doc) |
| **Active** | checkbox | Whether recipe is currently active |
| **Recipe Name** | singleLineText | Human-readable recipe name (Sakura uses this; Waratah does NOT have this field) |
| **Item Name** | multipleRecordLinks | → Items table. The item this recipe produces. |
| **Storage Notes** | multilineText | Storage instructions |
| **Service Notes** | multilineText | Service/usage instructions |
| **Recipe Lines** | multipleRecordLinks | → Recipe Lines table (ingredients for this recipe) |
| **Prep Tasks** | multipleRecordLinks | → Prep Tasks table (reverse link) |
| **Multiplier** | multipleLookupValues | Lookup from Item Name → Buffer Multiplier |
| **Ingredient Requirements** | multipleRecordLinks | → Ingredient Requirements table (reverse link) |
| **Handovers 2/3/4** | multipleRecordLinks | → Handovers table |
| **Feedback** | multipleRecordLinks | → Feedback table |

### Key relationships

- `Item Name` links to the Item this recipe **produces** (1:1 typically)
- `Recipe Lines` links to the ingredient rows that make up this recipe (1:many)
- `FinaliseCount.gs` validates that every Batch/Sub Recipe item has a corresponding recipe with non-zero yield

---

## 4. Recipe Lines

**Table ID:** `tblSkdQxcPMfkkFXw`
**Primary Field:** Line ID (autoNumber)
**Purpose:** Bill of Materials — each row is one ingredient needed for a recipe.

| Field | Type | Details |
|-------|------|---------|
| **Line ID** | autoNumber | Primary field |
| **Name** | singleLineText | Display name |
| **Item Name (from Recipe)** | multipleLookupValues | Lookup from Recipe → Item Name |
| **Recipe** | multipleRecordLinks | → Recipes table (which recipe this line belongs to) |
| **Item** | multipleRecordLinks | → Items table (the ingredient item needed) |
| **UI Name (from Item)** | multipleLookupValues | Lookup from Item → UI Name |
| **Qty** | number | Quantity of this ingredient per batch |
| **Unit** | multipleLookupValues | Lookup from Item → Unit |
| **Preparation Note** | multipleLookupValues | Lookup (source TBC) |
| **Sort Order** | number | Display ordering within recipe |
| **Made or Purchased** | multipleLookupValues | Lookup from Item → Made or Purchased |
| **Ingredient Unit** | multipleLookupValues | Lookup from Item → Unit |
| **Multiplier** | multipleLookupValues | Lookup from Item → Buffer Multiplier |
| **Feedback** | multipleRecordLinks | → Feedback table |

### How scripts use Recipe Lines

`GeneratePrepRun.gs` "explodes" recipes: for each Prep Task, it walks Recipe Lines to calculate total ingredient quantities needed. These become Ingredient Requirement records.

---

## 5. Par Levels

**Table ID:** `tblMHmMfaOp1dsDlb`
**Primary Field:** Par ID (autoNumber)
**Purpose:** Target stock levels for each item. Shortfall = Par Qty − Stock Count.

| Field | Type | Details |
|-------|------|---------|
| **Par ID** | autoNumber | Primary field |
| **UI Name (from Item Link)** | multipleLookupValues | Lookup from Item Link → UI Name |
| **Par Qty** | number | Target quantity to maintain |
| **Unit** | multipleLookupValues | Lookup from Item Link → Unit |
| **Active** | checkbox | Whether this par level is active |
| **Item Link** | multipleRecordLinks | → Items table |
| **Notes** | multilineText | Notes about par level reasoning |
| **Weekly Counts** | singleLineText | Legacy text field |

---

## 6. Weekly Counts

**Table ID:** `tblLIll0Viyp0VIp5`
**Primary Field:** Count Date (dateTime)
**Purpose:** Weekly stocktake records. Each row = one item's stock count for a given week.

| Field | Type | Details |
|-------|------|---------|
| **Count Date** | dateTime | Primary field. When the count was taken. |
| **Item Name (UI)** | multipleLookupValues | Lookup from Item → UI Name |
| **Batch Name** | multipleLookupValues | Lookup from Item → Cocktail Batch |
| **Stock Count** | number | Measured quantity on hand |
| **Unit** | multipleLookupValues | Lookup from Item → Unit |
| **Count Source** | singleSelect | **Stocktake (Verified)**, Generated / Placeholder |
| **Confirmed** | checkbox | Set to `true` by FinaliseCount.gs |
| **Confirmed At** | formula | Derived timestamp |
| **Item** | multipleRecordLinks | → Items table |
| **Menu Category** | multipleLookupValues | Lookup from Item → Menu Category |
| **Count Name** | aiText | AI-formatted item name |
| **Ingredient / Batch** | aiText | AI-formatted description |
| **Staff** | singleSelect | Sabs, Ev, Gooch, Kaliesha, Daniel, Vinny, Britt |
| **Notes** | multilineText | Count notes |
| **Prep Runs** | singleLineText | Legacy text field |
| **Confirmed Date** | formula | Count Date + 12 Hours |
| **Last Modified By** | lastModifiedBy | Auto-tracked collaborator |

### Weekly cycle

1. **Friday 8:00 AM:** `ClearPrepData.gs` deletes old Prep Tasks + Ingredient Requirements (automated scheduled trigger)
2. **Saturday 8:00 AM:** `ClearWeeklyCount.gs` deletes all existing records, creates placeholder rows (Stock Count = 0, Confirmed = false) for each active item (automated scheduled trigger)
3. **Saturday shift (3:30 PM – 3:00 AM):** Staff complete stocktake — fill in actual Stock Count values via the **Airtable Interface** (a purpose-built dashboard, not the raw table)
4. **Saturday shift:** Manager clicks **Finalise Count** button in the Interface → runs `FinaliseCount.gs` — validates all counts are non-blank, sets Confirmed = true, normalises Count Date
5. **Saturday shift:** Manager clicks **Generate Prep Run** and **Export** buttons in the Interface → runs `GeneratePrepRun.gs` → `GeneratePrepSheet.gs` → export to Google Docs → Slack notifications

---

## 7. Prep Runs

**Table ID:** `tblOQB5Q0WShkfrXH`
**Primary Field:** Prep Week (dateTime)
**Purpose:** A "run" is one weekly prep cycle. Links to all tasks, requirements, and export state.

| Field | Type | Details |
|-------|------|---------|
| **Prep Week** | dateTime | Primary field. The week this run covers. |
| **Ready** | checkbox | Whether the run is ready for export |
| **Link to Prep Guides** | url | URL to Google Drive folder with exported docs |
| **Notes / Handover Notes** | multilineText | Manager notes for the week |
| **Prep Tasks** | multipleRecordLinks | → Prep Tasks table |
| **Handovers** | multipleRecordLinks | → Handovers table |
| **Ingredient Requirements** | multipleRecordLinks | → Ingredient Requirements table |
| **Prep Run Requests** | multipleRecordLinks | → Prep Run Requests table |
| **Stocktake Count Date** | dateTime | The stocktake date this run was generated from |
| **Export Request State** | singleSelect | REQUESTED, IN_PROGRESS, DONE, FAILED |
| **Export Mode** | singleSelect | LIVE, TEST |
| **Export Notify Slack** | checkbox | Whether to send Slack notifications |
| **Export Requested At** | dateTime | When export was triggered |
| **Export Requested By** | singleLineText | Who triggered the export |
| **Export Last Error** | multilineText | Last export error message |
| **Export Finished At** | dateTime | When export completed |
| **Export Last Result** | multilineText | Export result summary |
| **Staff Shift Logs** | multipleRecordLinks | → Staff Shift Logs table |
| **AUDIT LOG** | multipleRecordLinks | → Audit Log table |
| **Started At** | dateTime | When generation started |
| **Finished At** | dateTime | When generation finished |
| **Error** | multilineText | Generation error |
| **Feedback** | multipleRecordLinks | → Feedback table |

### Export polling mechanism

`GoogleDocsPrepSystem.gs` polls for runs where `Export Request State` = `REQUESTED`. When found, it:
1. Sets state to `IN_PROGRESS`
2. Generates 4 Google Docs (Ingredient Prep List, Batching List, Gooch Ordering, Sabs Ordering)
3. Posts to Slack
4. Sets state to `DONE` (or `FAILED` with error)

---

## 8. Prep Tasks

**Table ID:** `tblVRN9gUjPSv6DP8`
**Primary Field:** Task ID (autoNumber)
**Purpose:** Individual prep tasks generated by `GeneratePrepRun.gs`. Each task = "make X batches of Item Y using Recipe Z".

| Field | Type | Details |
|-------|------|---------|
| **Task ID** | autoNumber | Primary field |
| **Calculation** | formula | Derived calculation display |
| **UI Name (from Item Needed)** | multipleLookupValues | Lookup from Item Needed → UI Name |
| **Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Run Date** | multipleLookupValues | Lookup from Prep Run → Prep Week |
| **Item Needed** | multipleRecordLinks | → Items table (the item to produce) |
| **Recipe Used** | multipleRecordLinks | → Recipes table (which recipe to follow) |
| **Yield Qty** | multipleLookupValues | Lookup from Recipe Used → Yield Qty |
| **Total Qty** | number | Total quantity to produce |
| **Unit** | multipleLookupValues | Lookup from Item Needed → Unit |
| **Method** | multipleLookupValues | Lookup from Recipe Used → Method |
| **Allocated To** | singleSelect | Evan, Gooch, Sabine, Kaliesha, Daniel, Joseph, Vinny, Britt |
| **Batches Needed** | number | `ceil(Target Qty / Yield Qty)` |
| **Completed** | checkbox | Whether task is done |
| **Target Qty** | number | Par Qty − Stock Count (the shortfall) |
| **Notes** | multilineText | Task notes |
| **Multiplier** | formula | Buffer multiplier calculation |
| **Staff Shift Logs** | multipleRecordLinks | → Staff Shift Logs table |
| **Suggested Qty (Buffer)** | number | Target Qty × Buffer Multiplier (default 1.5x) |

---

## 9. Ingredient Requirements

**Table ID:** `tblf8dAArfPxcd0wO`
**Primary Field:** Requirement ID (autoNumber)
**Purpose:** "Exploded" ingredient needs from prep tasks. Used to build ordering lists.

| Field | Type | Details |
|-------|------|---------|
| **Requirement ID** | autoNumber | Primary field |
| **Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Run Date** | multipleLookupValues | Lookup from Prep Run → Prep Week |
| **Recipe Link** | multipleRecordLinks | → Recipes table |
| **Item Link** | multipleRecordLinks | → Items table (the ingredient needed) |
| **Total Qty Needed** | number | Aggregated quantity across all tasks using this ingredient |
| **Unit** | multipleLookupValues | Lookup from Item Link → Unit |
| **Item Type** | multipleLookupValues | Lookup from Item Link → Item Type |
| **Method** | multipleLookupValues | Lookup from Recipe Link → Method |
| **Created Day** | createdTime | Auto-tracked |
| **Prep Run ID** | formula | Derived run identifier |
| **Supplier** | multipleLookupValues | Lookup from Item Link → Supplier |
| **Supplier Category** | multipleLookupValues | Lookup from Item Link → Product Category |
| **Ordering Staff** | multipleLookupValues | Lookup from Item Link → Ordering Staff |
| **Supplier (Static)** | singleLineText | Snapshot at generation time |
| **Supplier Name (Static)** | singleLineText | Snapshot at generation time |
| **Product Category (Static)** | singleLineText | Snapshot at generation time |
| **Ordering Staff (Static)** | singleLineText | Snapshot at generation time |
| **Order Size (Lookup)** | multipleLookupValues | Lookup from Item Link → Order Size |
| **Unit (Lookup)** | multipleLookupValues | Lookup from Item Link → Unit |

### Static vs dynamic fields

`GeneratePrepRun.gs` writes **static snapshot** fields (`Supplier (Static)`, `Supplier Name (Static)`, etc.) at generation time. This ensures ordering docs remain correct even if supplier assignments change later. The lookup fields (`Supplier`, `Ordering Staff`) show current live values.

---

## 10. Handovers

**Table ID:** `tbljuJfs7m8NlYhwN`
**Primary Field:** Handover ID (autoNumber)
**Purpose:** Shift handover records documenting what was done, what remains, and issues.

| Field | Type | Details |
|-------|------|---------|
| **Handover ID** | autoNumber | Primary field |
| **Handover Type** | singleSelect | (choices not detailed — used for categorisation) |
| **Week Of** | date | Which week |
| **Runs Included** | multipleRecordLinks | → Prep Runs table |
| **Summary** | multilineText | Overall summary |
| **Issues / Shortages** | multilineText | Problems encountered |
| **Done** | multipleRecordLinks | → Recipes table (completed items) |
| **To Be Completed** | multipleRecordLinks | → Recipes table (remaining items) |
| **Not Touched** | multipleRecordLinks | → Recipes table (not started) |
| **Actionables for Team** | richText | Action items |
| **Date** | date | Handover date |
| **Staff** | multipleSelects | Staff involved |
| **Orders Incoming** | multilineText | Expected deliveries |
| **Opening Jobs** | multipleSelects | Opening shift tasks |
| **Running Low (85/86)** | multilineText | Low stock alerts |
| **Extra Notes** | multilineText | Additional notes |
| **Prep / Cleaning Jobs** | multilineText | Outstanding jobs |
| **Staff Shift Logs** | multipleRecordLinks | → Staff Shift Logs table |

---

## 11. Recipe Database

**Table ID:** `tblmmMEg4x0Zw0GvE`
**Primary Field:** Name (singleLineText)
**Purpose:** Extended recipe knowledge base with tags, methods, and photos. Separate from the operational Recipes table.

| Field | Type | Details |
|-------|------|---------|
| **Name** | singleLineText | Primary field |
| **Ingredient Tags** | multipleSelects | Ingredient categorisation tags |
| **Produce/Pantry** | multipleSelects | Storage category |
| **Origin** | multipleSelects | Recipe origin/cuisine |
| **Cleaned Ingredients** | multilineText | Cleaned ingredient list |
| **Clean Method** | multilineText | Cleaned method text |
| **Linked Equipment** | singleLineText | Required equipment |
| **Linked Theories** | singleLineText | Related culinary theories |
| **FUNCTION (tags)** | multipleSelects | Functional categorisation |
| **INGREDIENT SYSTEM (tags)** | multipleSelects | Ingredient system tags |
| **Photos** | multipleAttachments | Recipe photos |
| **Feedback** | singleLineText | Feedback notes |

---

## 12. Prep Run Requests

**Table ID:** `tblk1ixh0ujExR8zM`
**Primary Field:** Name (singleLineText)
**Purpose:** Queue for triggering prep run generation. Airtable automation watches for `Run Now = true`.

| Field | Type | Details |
|-------|------|---------|
| **Name** | singleLineText | Primary field |
| **Run Now** | checkbox | Trigger flag — automation fires when checked |
| **Prep Week Override** | dateTime | Optional date override |
| **Status** | singleSelect | (tracks request lifecycle) |
| **Error** | multilineText | Error message if generation failed |
| **Prep Run** | multipleRecordLinks | → Prep Runs table (the generated run) |
| **Started At** | dateTime | When generation started |
| **Finished At** | dateTime | When generation finished |
| **Stocktake Count Date** | dateTime | Which stocktake was used |

---

## 13. Staff Shift Logs

**Table ID:** `tblfTNNBVHlGLqmFZ`
**Primary Field:** Shift Log ID (autoNumber)
**Purpose:** Per-shift staff logs covering tasks completed, issues, and sentiment.

| Field | Type | Details |
|-------|------|---------|
| **Shift Log ID** | autoNumber | Primary field |
| **Date** | date | Shift date |
| **Staff Member** | singleLineText | Staff name |
| **Shift Type** | singleSelect | Morning Prep, Afternoon Prep, Evening Prep, Night Prep |
| **Start Time** | dateTime | Shift start |
| **End Time** | dateTime | Shift end |
| **Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Handovers Included** | multipleRecordLinks | → Handovers table |
| **Tasks Completed** | multipleRecordLinks | → Prep Tasks table |
| **Shift Notes** | multilineText | General notes |
| **Issues or Shortages** | multilineText | Problems encountered |
| **Health and Safety Incidents** | multilineText | H&S incidents |
| **Signature/Initials** | singleLineText | Staff sign-off |
| **All Tasks Completed** | checkbox | Whether all assigned tasks were done |
| **Ingredients Checked** | checkbox | Whether ingredient check was performed |
| **Mood/Team Sentiment** | singleSelect | Excellent, Good, Neutral, Tense, Bad |
| **Tasks Checklist** | rollup | Rollup of tasks completion |
| **Stock Shortages** | multilineText | Stock shortage details |
| **Deliveries Received** | multilineText | Delivery log |
| **Maintenance Issues** | multilineText | Equipment/facility issues |
| **Recipe Improvement Suggestions** | multilineText | Staff recipe feedback |
| **Prep Team Notifications** | multilineText | Team comms |

---

## 14. Audit Log

**Table ID:** `tblMuw9e7lKpxJedd`
**Primary Field:** Timestamp (dateTime)
**Purpose:** Automated script execution log. Every script run (ClearWeeklyCount, FinaliseCount, GeneratePrepRun, Export) writes a record here.

| Field | Type | Details |
|-------|------|---------|
| **Timestamp** | dateTime | Primary field. When the script ran. |
| **Script Name** | singleSelect | CLEAR WEEKLY COUNT, FINALISE COUNT, GENERATE PREP RUN, EXPORT REQUEST |
| **Status** | singleSelect | SUCCESS, WARNING, ERROR |
| **Message** | multilineText | Summary of what happened |
| **Details** | multilineText | Extended details (item type breakdown, recipe issues, etc.) |
| **User** | singleLineText | Who triggered it (captured from Last Modified By) |
| **Execution Time (seconds)** | number | How long the script took |
| **Related Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Error Stack** | multilineText | Full error stack trace (on failure) |
| **Config Used** | multilineText | JSON of input configuration |

---

## 15. Feedback

**Table ID:** `tblZILjHboO4OGi5e`
**Primary Field:** Date (dateTime)
**Purpose:** Staff feedback submitted via the Feedback Form web app (`FeedbackForm.gs`).

| Field | Type | Details |
|-------|------|---------|
| **Date** | dateTime | Primary field |
| **Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Doc Type** | singleSelect | Ingredient Prep List, Batching List, Gooch Ordering, Sabs Ordering, Gooch Ordering List, Sabs Ordering List |
| **Staff Name** | singleLineText | Who submitted |
| **Staff Role** | singleSelect | Prep Team, Ordering - Gooch, Ordering - Sabs, Manager, Other |
| **Feedback Type** | singleSelect | Missing Data, Recipe Issue, Suggestion, Other |
| **Description** | multilineText | Full feedback text |
| **Item Reference** | multipleRecordLinks | → Items table |
| **Recipe Reference** | multipleRecordLinks | → Recipes table |
| **AI Category** | singleSelect | Data Fix, Recipe Update, General |
| **AI Suggestion** | multilineText | AI-generated suggested action |
| **AI Confidence** | number | AI confidence score |
| **Item Exists Check** | checkbox | Whether referenced item was found |
| **Found Recipe Line** | multipleRecordLinks | → Recipe Lines table |
| **Status** | singleSelect | New, In Review, Actioned, Resolved, Dismissed |
| **Slack Notification** | checkbox | Whether Slack was notified |
| **Created At** | createdTime | Auto-tracked |
| **Notes** | multilineText | Admin notes |

---

## 16. ADMIN CONTROLS

**Table ID:** `tblmejEsiXYwFWB6w`
**Primary Field:** Name (singleLineText)
**Purpose:** System-level configuration flags and controls.

| Field | Type | Details |
|-------|------|---------|
| **Name** | singleLineText | Control name/key |

---

## Table Relationships

```
Items ←──────────────────────────────────────────────────────────┐
  │                                                              │
  ├── Supplier (via "Supplier" link)                             │
  │     └── Ordering Staff, Product Category                     │
  │                                                              │
  ├── Recipes (via "Item Name" link = item this recipe produces) │
  │     └── Recipe Lines (via "Recipe" link)                     │
  │           └── Item (via "Item" link = ingredient needed)  ───┘
  │
  ├── Par Levels (via "Item Link")
  │
  ├── Weekly Counts (via "Item" link)
  │
  ├── Prep Tasks (via "Item Needed" link)
  │     └── Prep Run (via "Prep Run" link)
  │           └── Prep Run Requests (via "Prep Run" link)
  │
  ├── Ingredient Requirements (via "Item Link")
  │     ├── Prep Run (via "Prep Run" link)
  │     └── Recipe Link (via "Recipe Link")
  │
  └── Feedback (via "Item Reference" link)
        └── Recipe Reference → Recipes
```

### Core data flow

```
Par Levels (target) - Weekly Counts (actual) = Shortfall
   ↓
Shortfall × Buffer → Prep Tasks (what to make)
   ↓
Recipe Lines explosion → Ingredient Requirements (what to order)
   ↓
Grouped by Supplier → Ordering Lists (Google Docs)
```

---

## Script Field Mappings

Quick reference for which CONFIG keys map to which Airtable fields in each script.

### ClearWeeklyCount.gs

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `itemsTableName` | Items | — |
| `countsTableName` | Weekly Counts | — |
| `auditLogTableName` | Audit Log | — |
| `itemTypeField` | Item Type | Items |
| `itemActiveField` | Active | Items |
| `countItemLinkField` | Item | Weekly Counts |
| `countQtyField` | Stock Count | Weekly Counts |
| `countDateField` | Count Date | Weekly Counts |
| `countSourceField` | Count Source | Weekly Counts |
| `countConfirmedField` | Confirmed | Weekly Counts |
| `allowedItemTypes` | Batch, Sub Recipe, Sub-recipe, Garnish, Other | Items.Item Type |

### FinaliseCount.gs

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `countsTableName` | Weekly Counts | — |
| `itemsTableName` | Items | — |
| `recipesTableName` | Recipes | — |
| `recipeLinesTableName` | Recipe Lines | — |
| `itemNameField` | Item Name | Items |
| `recipeProducesItemField` | Item Name | Recipes |
| `recipeYieldField` | Yield Qty | Recipes |
| `lineRecipeField` | Recipe | Recipe Lines |
| `lineComponentItemField` | Item | Recipe Lines |

### GeneratePrepRun.gs

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `parTableName` | Par Levels | — |
| `parItemLinkField` | Item Link | Par Levels |
| `parQtyField` | Par Qty | Par Levels |
| `runsTableName` | Prep Runs | — |
| `tasksTableName` | Prep Tasks | — |
| `reqTableName` | Ingredient Requirements | — |
| `requestsTableName` | Prep Run Requests | — |
| `itemBufferMultiplierField` | Buffer Multiplier | Items |
| `itemExpectedSalesField` | Weekly Volume (ml) | Items |
| `itemSupplierLinkField` | Supplier | Items |
| `itemSupplierNameLookupField` | Supplier Name | Items |
| `itemProductCategoryLookupField` | Product Category | Items |
| `itemOrderingStaffLookupField` | Ordering Staff | Items |
| `taskItemToProduceField` | Item Needed | Prep Tasks |
| `taskRecipeUsedField` | Recipe Used | Prep Tasks |
| `taskTargetQtyField` | Target Qty | Prep Tasks |
| `taskBatchesNeededField` | Batches Needed | Prep Tasks |
| `taskSuggestedQtyField` | Suggested Qty (Buffer) | Prep Tasks |
| `reqItemNeededField` | Item Link | Ingredient Requirements |
| `reqRecipeField` | Recipe Link | Ingredient Requirements |
| `reqTotalQtyField` | Total Qty Needed | Ingredient Requirements |
| `reqSupplierLinkStaticField` | Supplier (Static) | Ingredient Requirements |
| `reqSupplierNameStaticField` | Supplier Name (Static) | Ingredient Requirements |
| `reqProductCategoryStaticField` | Product Category (Static) | Ingredient Requirements |
| `reqOrderingStaffStaticField` | Ordering Staff (Static) | Ingredient Requirements |

### GoogleDocsPrepSystem.gs

| CFG Path | Airtable Field | Table |
|----------|---------------|-------|
| `airtable.fields.itemName` | Item Name | Items |
| `airtable.fields.itemType` | Item Type | Items |
| `airtable.fields.itemUnit` | Unit | Items |
| `airtable.fields.recipeName` | Recipe Name | Recipes |
| `airtable.fields.recipeMethod` | Method | Recipes |
| `airtable.fields.rlRecipe` | Recipe | Recipe Lines |
| `airtable.fields.rlItem` | Item | Recipe Lines |
| `airtable.fields.rlQty` | Qty | Recipe Lines |
| `airtable.fields.supplierName` | Supplier Name | Supplier |
| `airtable.fields.supplierOrderingStaff` | Ordering Staff | Supplier |
| `airtable.fields.supplierEmail` | Email | Supplier |
| `airtable.fields.reqSupplierNameStatic` | Supplier Name (Static) | Ingredient Requirements |
| `airtable.fields.reqStaffStatic` | Ordering Staff (Static) | Ingredient Requirements |
| `airtable.fields.reqOrderSize` | Order Size (Lookup) | Ingredient Requirements |

---

## Weekly Cycle Workflow

The PREP system runs on a weekly cycle controlled by Airtable automations calling these scripts:

```
FRIDAY 8 AM          SATURDAY 8 AM          SATURDAY SHIFT (3:30 PM – 3:00 AM)
──────────────────────────────────────────────────────────────────────────────
ClearPrepData.gs     ClearWeeklyCount.gs    Staff count stock → Manager runs:
  (scheduled)          (scheduled)
  • Deletes old        • Deletes old         FinaliseCount.gs
    Prep Tasks           counts                • Validates no blanks
  • Deletes old        • Creates               • Sets Confirmed=true
    Ingredient Reqs      placeholders          • Recipe integrity check
  • Logs to              for active items           ↓
    Audit Log          • Logs to              GeneratePrepRun.gs
                         Audit Log              • Calculates shortfalls
                                                • Creates Prep Tasks
                                                • Explodes → Ingredient Reqs
                                                     ↓
                                              GoogleDocsPrepSystem.gs
                                                • Polls Export Request State
                                                • Generates 4 Google Docs
                                                • Posts links to Slack
                                                • Sets state to DONE

SUNDAY–MONDAY                    TUESDAY–WEDNESDAY
─────────────────────────────    ─────────────────────
Orders arrive                    Remaining orders arrive
Extra ordering done              Prep is executed
```

---

## Differences from Waratah

| Feature | Sakura House | The Waratah |
|---------|-------------|-------------|
| Base ID | `appNsFRhuU47e9qlR` | `appfcy14ZikhKZnRS` |
| Recipe name | `Recipe Name` (singleLineText) | `Item Name` (linked record → Items) |
| Item Name field | singleLineText (primary) | Linked record (primary) |
| Ordering staff | Gooch, Sabs | Andie, Blade |
| Item Type values | Batch, Sub Recipe, Sub-recipe, Ingredient, Garnish, Other, in | Batch, Sub Recipe, Sub-recipe (3 required) |
| Weekly cycle | Fri AM clear → Sat AM reset → Sat shift (count/generate/order) → Sun–Wed (delivery/prep) | Mon–Fri cycle |
| Script prefix | None | `Waratah_` for Airtable scripts |
| Recipe Database table | Yes (separate knowledge base) | No |
| Handovers table | Yes (detailed shift handovers) | No |
| Staff Shift Logs table | Yes | No |
