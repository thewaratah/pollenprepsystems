# The Waratah — Airtable Schema Reference

*Complete schema documentation for the Waratah Airtable base. For developers, admins, and Evan.*

**Base ID:** `appfcy14ZikhKZnRS`
**Last Updated:** 2026-03-22
**Source:** Live Airtable base + script CONFIG field mappings

---

> **How users access this data:** Evan and bar staff interact with the PREP system through **Airtable Interfaces** — purpose-built dashboards with buttons, forms, and filtered views. The tables documented below are the **underlying data layer**. Only admins access raw tables directly (for adding items, suppliers, recipes, and troubleshooting). All weekly-cycle actions (stock counting, validating, generating prep runs, ordering) are performed via Interface buttons.

---

## Table of Contents

*Jump to any table or section.*

1. [Items](#1-items)
2. [Supplier](#2-supplier)
3. [Recipes](#3-recipes)
4. [Recipe Lines](#4-recipe-lines)
5. [Par Levels](#5-par-levels)
6. [Weekly Counts](#6-weekly-counts)
7. [Prep Runs](#7-prep-runs)
8. [Prep Tasks](#8-prep-tasks)
9. [Ingredient Requirements](#9-ingredient-requirements)
10. [Count Sessions](#10-count-sessions)
11. [Stock Counts](#11-stock-counts)
12. [Stock Orders](#12-stock-orders)
13. [Audit Log](#13-audit-log)
14. [Feedback](#14-feedback)
15. [Admin Controls](#15-admin-controls)
16. [Table Relationships](#table-relationships)
17. [Core Data Flow](#core-data-flow)
18. [Script Field Mappings](#script-field-mappings)
19. [Item Type Values Used by Scripts](#item-type-values-used-by-scripts)
20. [Differences from Sakura Schema](#differences-from-sakura-schema)

---

## 1. Items

*Master list of every product the bar tracks — spirits, wines, batches, ingredients, garnishes, and more.*

**Primary Field:** Item Name
**Purpose:** Central reference for all items managed by the PREP and stock ordering systems. Every other table links back here.

| Field | Type | Details |
|-------|------|---------|
| **Item Name** | singleLineText | Primary field. Plain text name. |
| **Item Type** | singleSelect | Extended set: **Batch**, **Sub Recipe**, **Sub-recipe**, **Ingredient**, **Garnish**, **Other**, **Spirit**, **Wine**, **Beer**, **Mixer**, **RTD** |
| **Active** | checkbox | Whether item is currently in use |
| **Bar Stock** | checkbox | Whether item is counted as bar stock (~414 items). Superset of Core Order. |
| **Core Order** | checkbox | Whether item is included in weekly stock count and ordering (~59 items). Canonical counting scope filter. |
| **Unit** | singleSelect | ml, g, each, case, keg |
| **Order Volume** | number | Millilitres per bottle or case. Used for unit conversion (ml counts to bottle/case order quantities). |
| **Supplier** | multipleRecordLinks | → Supplier table |
| **Location** | multipleSelects | Physical storage locations (12 choices): Under PB Station, PB Backbar, PB Fridge, Under TB Station, TB Backbar, TB Fridge, Banquettes, Freezer, Hallway, Keg Room, Cool Room, B1 |
| **Buffer Multiplier** | number | Per-item override for the default 1.5x buffer (e.g. 2.0 for high-demand items) |
| **Weekly Volume** | number | Expected weekly consumption. Used by prep shortfall calculations. |
| **Status** | singleSelect | Active, Inactive |
| **Supplier Name** | multipleLookupValues | Lookup from Supplier → Supplier Name |
| **Product Category** | multipleLookupValues | Lookup from Supplier → Product Category |
| **Ordering Staff** | multipleLookupValues | Lookup from Supplier → Ordering Staff |
| **Recipes** | multipleRecordLinks | → Recipes table |
| **Recipe Lines** | multipleRecordLinks | → Recipe Lines table |
| **Par Levels** | multipleRecordLinks | → Par Levels table |
| **Weekly Counts** | multipleRecordLinks | → Weekly Counts table |
| **Prep Tasks** | multipleRecordLinks | → Prep Tasks table |
| **Ingredient Requirements** | multipleRecordLinks | → Ingredient Requirements table |
| **Feedback** | multipleRecordLinks | → Feedback table |
| **Notes** | richText | Free-form notes |
| **Item ID** | autoNumber | Internal auto-incrementing ID |

### Item Type values — full set

The Waratah uses an extended Item Type set compared to Sakura. The beverage types (Spirit, Wine, Beer, Mixer, RTD) are unique to Waratah and represent bar stock items that are ordered but not prepped.

| Value | Appears in prep docs? | Appears in ordering? | Notes |
|-------|----------------------|---------------------|-------|
| Batch | Yes (Batching List + Ingredient Prep List) | No (made in-house) | Primary prep items |
| Sub Recipe | Yes (Ingredient Prep List) | No (made in-house) | Component recipes |
| Sub-recipe | Yes (Ingredient Prep List) | No (made in-house) | Legacy variant of Sub Recipe |
| Ingredient | No | Yes | Purchased ingredients for prep |
| Garnish | Yes (Ingredient Prep List only) | No | Fresh garnishes prepped in-house |
| Other | Yes (Ingredient Prep List only) | No | Miscellaneous prep items |
| Spirit | No | Yes (bar stock) | Spirits ordered via stock count pipeline |
| Wine | No | Yes (bar stock) | Wines ordered via stock count pipeline |
| Beer | No | Yes (bar stock) | Beers ordered via stock count pipeline |
| Mixer | No | Yes (bar stock) | Mixers ordered via stock count pipeline |
| RTD | No | Yes (bar stock) | Ready-to-drink items ordered via stock count pipeline |

---

## 2. Supplier

*Directory of all suppliers with product categories and ordering staff assignment.*

**Primary Field:** Supplier Name
**Purpose:** Supplier directory. Each supplier links to the items it provides. Used to group ordering docs by supplier.

| Field | Type | Details |
|-------|------|---------|
| **Supplier Name** | singleLineText | Primary field |
| **Email** | email | Supplier contact email |
| **Product Category** | singleSelect | Alcohol, Prep Ingredients, Fruit & Veg, Prep Pantry, General, and others |
| **Ordering Staff** | singleSelect | Field exists for future use. Currently Evan is the sole operator. |
| **Items** | multipleRecordLinks | → Items table (reverse link) |

### Ordering staff note

Waratah uses a **combined ordering doc** — all supplier orders appear in a single document. The per-staff split (Andie/Blade) has been retired. Evan is the sole operator for all ordering.

---

## 3. Recipes

*Recipes that produce Items. Each recipe links to one Item and has multiple Recipe Lines (ingredients).*

**Primary Field:** Recipe ID (autoNumber)
**Purpose:** Defines how to make each Batch or Sub Recipe item, including yield and method.

| Field | Type | Details |
|-------|------|---------|
| **Recipe ID** | autoNumber | Primary field (auto-incrementing) |
| **Item Name** | multipleRecordLinks | **LINKED RECORD → Items table.** The item this recipe produces. NOT a text field. See note below. |
| **Yield Qty** | number | How much one batch produces (in the item's unit) |
| **Method** | richText | Step-by-step preparation method (included in Batching List doc) |
| **Status** | singleSelect | Recipe status |
| **Active** | checkbox | Whether recipe is currently active |
| **Unit** | multipleLookupValues | Lookup from Item Name → Unit |
| **Recipe Lines** | multipleRecordLinks | → Recipe Lines table (ingredients for this recipe) |
| **Prep Tasks** | multipleRecordLinks | → Prep Tasks table (reverse link) |
| **Multiplier** | multipleLookupValues | Lookup from Item Name → Buffer Multiplier |
| **Ingredient Requirements** | multipleRecordLinks | → Ingredient Requirements table (reverse link) |
| **Feedback** | multipleRecordLinks | → Feedback table |
| **Storage Notes** | multilineText | Storage instructions |
| **Service Notes** | multilineText | Service/usage instructions |

### CRITICAL: Item Name is a linked record, not text

Unlike Sakura House (which has a plain-text `Recipe Name` field), Waratah's Recipes table uses **`Item Name`** as a **linked record** pointing to the Items table. The Airtable REST API returns this as an array of record IDs (e.g. `["recXXX"]`), not a human-readable name.

**Two-step name resolution pattern** (used by `RecipeScaler.gs`):
1. Fetch all active Items → build an `id → name` map
2. Fetch all Recipes (paginated)
3. For each recipe, resolve the name from the linked item ID in the `Item Name` field
4. Filter out inactive recipes

Never reference `fields['Recipe Name']` in Waratah GAS code — that field does not exist.

---

## 4. Recipe Lines

*Bill of Materials — each row is one ingredient needed for a recipe.*

**Primary Field:** Line ID (autoNumber)
**Purpose:** Defines the ingredients and quantities for each recipe. Scripts "explode" these to calculate total ingredient needs.

| Field | Type | Details |
|-------|------|---------|
| **Line ID** | autoNumber | Primary field |
| **Recipe** | multipleRecordLinks | → Recipes table (which recipe this line belongs to) |
| **Item** | multipleRecordLinks | → Items table (the ingredient item needed) |
| **Qty** | number | Quantity of this ingredient per batch |
| **Unit** | multipleLookupValues | Lookup from Item → Unit |
| **Sort Order** | number | Display ordering within recipe |
| **Name** | singleLineText | Display name |
| **Feedback** | multipleRecordLinks | → Feedback table |

### How scripts use Recipe Lines

`Waratah_GeneratePrepRun.gs` "explodes" recipes: for each Prep Task, it walks Recipe Lines to calculate total ingredient quantities needed. These become Ingredient Requirement records.

---

## 5. Par Levels

*Target stock levels for each item. Shortfall = Par Qty minus Stock Count.*

**Primary Field:** Par ID (autoNumber)
**Purpose:** Defines the target quantity to maintain for each item. Used by both prep shortfall calculations and stock ordering.

| Field | Type | Details |
|-------|------|---------|
| **Par ID** | autoNumber | Primary field |
| **Item Link** | multipleRecordLinks | → Items table |
| **Par Qty** | number | Target quantity to maintain |
| **Active** | checkbox | Whether this par level is active |
| **Unit** | multipleLookupValues | Lookup from Item Link → Unit |
| **Notes** | multilineText | Notes about par level reasoning |

### Two types of pars

- **Service pars** (bar stock items): Target stock levels for spirits, wines, beers, etc. Used by `Waratah_GenerateStockOrders.gs` to calculate service shortfall.
- **Production pars** (prep batches): Target stock levels for batches and sub-recipes. Used by `Waratah_GeneratePrepRun.gs` to calculate prep shortfall.

---

## 6. Weekly Counts

*Prep-only weekly stocktake records. Separate from the Stock Counts table used for bar stock ordering.*

**Primary Field:** Count Date (dateTime)
**Purpose:** Weekly stocktake records for prep items (Batch, Sub Recipe, Garnish, Other). Each row = one item's stock count for a given week.

| Field | Type | Details |
|-------|------|---------|
| **Count Date** | dateTime | Primary field. When the count was taken. |
| **Item** | multipleRecordLinks | → Items table |
| **Stock Count** | number | Measured quantity on hand |
| **Count Source** | singleSelect | **Stocktake (Verified)**, Generated / Placeholder |
| **Confirmed** | checkbox | Set to `true` by `Waratah_FinaliseCount.gs` |
| **Staff** | singleSelect | Staff who performed the count |
| **Notes** | multilineText | Count notes |

### Weekly cycle (prep counts)

1. **Saturday AM:** `Waratah_ClearWeeklyCount.gs` deletes old records, creates placeholder rows for active prep items
2. **Sunday:** Bar staff complete prep stocktake via Airtable Interface
3. **Monday AM:** `Waratah_FinaliseCount.gs` validates, sets Confirmed = true
4. **Monday AM:** `Waratah_GeneratePrepRun.gs` calculates shortfalls and generates prep tasks

---

## 7. Prep Runs

*A "run" is one weekly prep cycle. Links to all tasks, requirements, and export state.*

**Primary Field:** Prep Week (dateTime)
**Purpose:** Tracks a complete prep generation cycle, including export state for Google Docs.

| Field | Type | Details |
|-------|------|---------|
| **Prep Week** | dateTime | Primary field. The week this run covers. |
| **Ready** | checkbox | Whether the run is ready for export |
| **Export Request State** | singleSelect | REQUESTED, IN_PROGRESS, DONE, FAILED |
| **Notes / Handover Notes** | multilineText | Manager notes for the week |
| **Link to Prep Guides** | url | URL to Google Drive folder with exported docs |
| **Prep Tasks** | multipleRecordLinks | → Prep Tasks table |
| **Ingredient Requirements** | multipleRecordLinks | → Ingredient Requirements table |
| **Stocktake Count Date** | dateTime | The stocktake date this run was generated from |
| **Export Mode** | singleSelect | LIVE, TEST |
| **Export Notify Slack** | checkbox | Whether to send Slack notifications |
| **Export Requested At** | dateTime | When export was triggered |
| **Export Requested By** | singleLineText | Who triggered the export |
| **Export Last Error** | multilineText | Last export error message |
| **Export Finished At** | dateTime | When export completed |
| **Export Last Result** | multilineText | Export result summary |
| **AUDIT LOG** | multipleRecordLinks | → Audit Log table |
| **Started At** | dateTime | When generation started |
| **Finished At** | dateTime | When generation finished |
| **Error** | multilineText | Generation error |
| **Feedback** | multipleRecordLinks | → Feedback table |

### Export polling mechanism

`GoogleDocsPrepSystem.gs` polls for runs where `Export Request State` = `REQUESTED`. When found:
1. Sets state to `IN_PROGRESS`
2. Generates 3 Google Docs (Ingredient Prep List, Batching List, Combined Ordering)
3. Posts links to Slack
4. Sets state to `DONE` (or `FAILED` with error)

---

## 8. Prep Tasks

*Individual prep tasks generated by the prep run. Each task = "make X batches of Item Y using Recipe Z".*

**Primary Field:** Task ID (autoNumber)
**Purpose:** Actionable prep tasks telling bar staff what to make, how much, and which recipe to follow.

| Field | Type | Details |
|-------|------|---------|
| **Task ID** | autoNumber | Primary field |
| **Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Item Needed** | multipleRecordLinks | → Items table (the item to produce) |
| **Recipe Used** | multipleRecordLinks | → Recipes table (which recipe to follow) |
| **Target Qty** | number | Par Qty minus Stock Count (the shortfall) |
| **Batches Needed** | number | `ceil(Target Qty / Yield Qty)` |
| **Suggested Qty (Buffer)** | number | Target Qty multiplied by Buffer Multiplier (default 1.5x) |
| **Total Qty** | number | Total quantity to produce |
| **Unit** | multipleLookupValues | Lookup from Item Needed → Unit |
| **Method** | multipleLookupValues | Lookup from Recipe Used → Method |
| **Yield Qty** | multipleLookupValues | Lookup from Recipe Used → Yield Qty |
| **Completed** | checkbox | Whether task is done |
| **Notes** | multilineText | Task notes |

---

## 9. Ingredient Requirements

*"Exploded" ingredient needs from prep tasks. Used to build the prep ingredient list and ordering docs.*

**Primary Field:** Requirement ID (autoNumber)
**Purpose:** Aggregated ingredient quantities needed across all prep tasks for a run. Drives both the Ingredient Prep List doc and the prep-only section of the Combined Ordering doc.

| Field | Type | Details |
|-------|------|---------|
| **Requirement ID** | autoNumber | Primary field |
| **Prep Run** | multipleRecordLinks | → Prep Runs table |
| **Recipe Link** | multipleRecordLinks | → Recipes table |
| **Item Link** | multipleRecordLinks | → Items table (the ingredient needed) |
| **Total Qty Needed** | number | Aggregated quantity across all tasks using this ingredient |
| **Unit** | multipleLookupValues | Lookup from Item Link → Unit |
| **Item Type** | multipleLookupValues | Lookup from Item Link → Item Type |
| **Method** | multipleLookupValues | Lookup from Recipe Link → Method |
| **Supplier (Static)** | singleLineText | Snapshot at generation time |
| **Supplier Name (Static)** | singleLineText | Snapshot at generation time |
| **Product Category (Static)** | singleLineText | Snapshot at generation time |
| **Ordering Staff (Static)** | singleLineText | Snapshot at generation time |
| **Supplier** | multipleLookupValues | Lookup from Item Link → Supplier (live) |
| **Ordering Staff** | multipleLookupValues | Lookup from Item Link → Ordering Staff (live) |

### Static vs dynamic fields

`Waratah_GeneratePrepRun.gs` writes **static snapshot** fields (`Supplier (Static)`, `Supplier Name (Static)`, etc.) at generation time. This ensures ordering docs remain correct even if supplier assignments change later. The lookup fields (`Supplier`, `Ordering Staff`) show current live values.

---

## 10. Count Sessions

*Tracks each weekly bar stock counting session through its lifecycle.*

**Primary Field:** Session Date (dateTime)
**Purpose:** Orchestrates the stock count pipeline. Each session progresses through statuses and links to all Stock Counts and Stock Orders for that week.

| Field | Type | Details |
|-------|------|---------|
| **Session Date** | dateTime | When the session was created |
| **Session Name** | formula | Auto-generated display name from date |
| **Status** | singleSelect | **Not Started** → **In Progress** → **Completed** → **Validated** → **Orders Generated** |
| **Counted By** | singleLineText | Who performed the count |
| **Stock Counts** | multipleRecordLinks | → Stock Counts table (reverse link — all count records for this session) |
| **Stock Orders** | multipleRecordLinks | → Stock Orders table (reverse link — all order records for this session) |
| **Ordering Export State** | singleSelect | REQUESTED, COMPLETED, ERROR. Polled by GAS `processOrderingExportRequests()`. |
| **Notes** | multilineText | Session notes |

### Status lifecycle

```
Not Started → In Progress → Completed → Validated → Orders Generated
     ↑              ↑            ↑            ↑             ↑
  InitStock    (counting)   Complete     Validate     GenerateStock
  Count.gs                  StockCount   StockCount   Orders.gs
                            .gs          .gs
```

### Ordering Export State

Separate from Status. Controls the ordering doc export pipeline:
- `REQUESTED` — Set by `Waratah_GenerateStockOrders.gs` (auto) or `Waratah_ExportOrderingDoc.gs` (manual)
- `COMPLETED` — Set by `GoogleDocsPrepSystem.gs` after successful doc generation
- `ERROR` — Set by `GoogleDocsPrepSystem.gs` on failure

---

## 11. Stock Counts

*Per-item bar stock counts with area-by-area tallies. One record per item per Count Session.*

**Primary Field:** auto-generated
**Purpose:** Records how much of each Core Order item is on hand, broken down by 5 counting areas. Formula field calculates the total.

| Field | Type | Details |
|-------|------|---------|
| **Item** | multipleRecordLinks | → Items table (the item being counted) |
| **Count Session** | multipleRecordLinks | → Count Sessions table |
| **Public Bar** | number (1dp) | Tally for: Under PB Station, PB Backbar, PB Fridge |
| **Terrace Bar** | number (1dp) | Tally for: Under TB Station, TB Backbar, TB Fridge |
| **Banquettes** | number (1dp) | Tally for: Banquettes, Freezer |
| **Cool Rooms** | number (1dp) | Tally for: Hallway, Keg Room, Cool Room |
| **Back Storage** | number (1dp) | Tally for: B1 |
| **Total On Hand** | formula | Sum of 5 tally columns. Returns BLANK when all tallies are empty. See formula below. |
| **Previous Count** | number | Previous session's total (for comparison/outlier detection) |
| **Needs Review** | checkbox | Flagged by `Waratah_ValidateStockCount.gs` for outliers or missing data |
| **Notes** | multilineText | Count notes |

### Total On Hand formula

Returns BLANK() when all tallies are empty — this distinguishes "not counted" from "counted, total is zero". Scripts read this field to detect uncounted items.

```
IF(OR({Public Bar},{Terrace Bar},{Banquettes},{Cool Rooms},{Back Storage}),
   ({Public Bar}+{Terrace Bar}+{Banquettes}+{Cool Rooms}+{Back Storage}),
   BLANK())
```

### 5 counting areas mapped to physical locations

| Tally Column | Physical Locations Covered |
|--------------|---------------------------|
| Public Bar | Under PB Station, PB Backbar, PB Fridge |
| Terrace Bar | Under TB Station, TB Backbar, TB Fridge |
| Banquettes | Banquettes, Freezer |
| Cool Rooms | Hallway, Keg Room, Cool Room |
| Back Storage | B1 |

### Scope

Only items with **`Core Order = true`** on the Items table (~59 items) get Stock Count records. This is a subset of `Bar Stock = true` (~414 items). `Core Order` is the canonical filter for counting scope.

---

## 12. Stock Orders

*Generated order quantities for each item, combining service shortfall with prep usage.*

**Primary Field:** auto-generated
**Purpose:** One record per item per Count Session. Stores the calculated order quantity and supplier info for the Combined Ordering doc.

| Field | Type | Details |
|-------|------|---------|
| **Item** | multipleRecordLinks | → Items table |
| **Count Session** | multipleRecordLinks | → Count Sessions table |
| **Total On Hand** | number | Copied from Stock Counts at generation time |
| **Prep Usage** | number | Quantity needed for prep (from latest Prep Run's Ingredient Requirements) |
| **Prep Qty** | number | Bar stock par level for this item (from Par Levels) |
| **Service Shortfall** | number | `MAX(0, Par Qty - Total On Hand)` |
| **Combined Order Qty** | number | `Service Shortfall + Prep Usage` — the final order quantity |
| **Supplier Name (Static)** | singleLineText | Snapshot at generation time |
| **Product Category (Static)** | singleLineText | Snapshot at generation time |
| **Ordering Staff (Static)** | singleLineText | Snapshot at generation time |
| **Status** | singleSelect | Pending, Ordered, Received |
| **Notes** | multilineText | Order notes |

### Ordering formula per item

```
Service Shortfall = MAX(0, Par Qty - Total On Hand)
Combined Order Qty = Service Shortfall + Prep Usage
```

Where Prep Usage comes from the latest Prep Run's Ingredient Requirements table (matched by item).

### Idempotent generation

`Waratah_GenerateStockOrders.gs` deletes all existing Stock Order records for the session before regenerating. Safe for re-runs.

---

## 13. Audit Log

*Automated script execution log. Every script run writes a record here for traceability.*

**Primary Field:** Timestamp (dateTime)
**Purpose:** Provides a complete audit trail of all automation executions, including success/failure status, timing, and configuration.

| Field | Type | Details |
|-------|------|---------|
| **Timestamp** | dateTime | Primary field. When the script ran. |
| **Script Name** | singleSelect | WARATAH - CLEAR WEEKLY COUNT, WARATAH - INIT STOCK COUNT, WARATAH - VALIDATE STOCK COUNT, WARATAH - GENERATE STOCK ORDERS, WARATAH - GENERATE PREP RUN, and others |
| **Status** | singleSelect | SUCCESS, WARNING, ERROR |
| **Message** | multilineText | Summary of what happened |
| **Details** | multilineText | Extended details (item counts, breakdowns, etc.) |
| **User** | singleLineText | Who triggered it |
| **Execution Time (seconds)** | number | How long the script took |
| **Error Stack** | multilineText | Full error stack trace (on failure) |
| **Config Used** | multilineText | JSON of input configuration |

---

## 14. Feedback

*Staff feedback submitted via the Feedback Form web app.*

**Primary Field:** Date (dateTime)
**Purpose:** Collects structured feedback from bar staff about prep docs, recipes, and processes. AI triage suggests categories and actions.

| Field | Type | Details |
|-------|------|---------|
| **Date** | dateTime | Primary field |
| **Doc Type** | singleSelect | Ingredient Prep List, Batching List, Combined Ordering |
| **Staff Name** | singleLineText | Who submitted |
| **Staff Role** | singleSelect | Bar Staff, Manager, Other |
| **Feedback Type** | singleSelect | Missing Data, Recipe Issue, Suggestion, Other |
| **Description** | multilineText | Full feedback text |
| **Item Reference** | multipleRecordLinks | → Items table |
| **Recipe Reference** | multipleRecordLinks | → Recipes table |
| **AI Category** | singleSelect | Data Fix, Recipe Update, General |
| **AI Suggestion** | multilineText | AI-generated suggested action |
| **Status** | singleSelect | New, In Review, Actioned, Resolved, Dismissed |
| **Slack Notification** | checkbox | Whether Slack was notified |

---

## 15. Admin Controls

*System-level configuration flags and key-value settings.*

**Primary Field:** Name (singleLineText)
**Purpose:** Stores admin-configurable settings as key-value pairs. Used by scripts for feature flags and system configuration.

| Field | Type | Details |
|-------|------|---------|
| **Name** | singleLineText | Control name/key |

---

## Table Relationships

*How all 15 tables link together. Arrows show linked record relationships.*

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
  ├── Weekly Counts (via "Item" link)         ← prep item counts
  │
  ├── Stock Counts (via "Item" link)          ← bar stock counts
  │     └── Count Sessions (via "Count Session" link)
  │           └── Stock Orders (via "Count Session" link)
  │                 └── Item (via "Item" link)  ──────────────→ Items
  │
  ├── Prep Tasks (via "Item Needed" link)
  │     └── Prep Runs (via "Prep Run" link)
  │           └── Ingredient Requirements (via "Prep Run" link)
  │                 ├── Item Link ────────────────────────────→ Items
  │                 └── Recipe Link ──────────────────────────→ Recipes
  │
  └── Feedback (via "Item Reference" link)
        └── Recipe Reference → Recipes
```

### Stock count flow

```
Items ← Stock Counts → Count Sessions → Stock Orders → Items
```

### Prep flow

```
Items ← Recipes → Recipe Lines → Items (ingredients)
Items ← Par Levels
Items ← Weekly Counts
Items ← Prep Tasks → Prep Runs → Ingredient Requirements → Items
```

---

## Core Data Flow

*How stock counts, par levels, and recipes combine to produce prep tasks and ordering docs.*

### Prep pipeline

```
Par Levels (target) - Weekly Count (actual) = Shortfall
   ↓
Shortfall × Buffer → Prep Tasks (what to make)
   ↓
Recipe Lines explosion → Ingredient Requirements (what ingredients are needed)
```

### Stock ordering pipeline

```
Par Levels (service target) - Stock Count (actual) = Service Shortfall
                                                          ↓
Service Shortfall + Prep Usage (from Ingredient Reqs) = Combined Order Qty
                                                          ↓
Grouped by Supplier → Combined Ordering Doc (Google Doc)
```

### Full weekly pipeline

```
InitStockCount → Stock Count records created (~59 items)
        ↓
Evan counts stock → area-by-area tallies entered
        ↓
CompleteStockCount → pre-flight checks → status = Completed
        ↓
ValidateStockCount → outlier/missing checks → status = Validated
        ↓
GenerateStockOrders → creates Stock Order records + sets REQUESTED
        ↓
GAS polling → generates Combined Ordering Doc → Slack notification
```

---

## Script Field Mappings

*Quick reference for which CONFIG keys map to which Airtable fields in each script.*

### Waratah_ClearWeeklyCount.gs

*Resets prep-only weekly counts and creates placeholder rows for active items.*

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `itemsTableName` | Items | -- |
| `countsTableName` | Weekly Counts | -- |
| `auditLogTableName` | Audit Log | -- |
| `itemTypeField` | Item Type | Items |
| `itemActiveField` | Active | Items |
| `countItemLinkField` | Item | Weekly Counts |
| `countQtyField` | Stock Count | Weekly Counts |
| `countDateField` | Count Date | Weekly Counts |
| `countSourceField` | Count Source | Weekly Counts |
| `countConfirmedField` | Confirmed | Weekly Counts |
| `countStaffField` | Staff | Weekly Counts |
| `allowedItemTypes` | Batch, Sub Recipe, Sub-recipe, Garnish, Other | Items.Item Type |

### Waratah_InitStockCount.gs

*Initializes a stock count session with placeholder records for Core Order items.*

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `itemsTableName` | Items | -- |
| `countSessionsTableName` | Count Sessions | -- |
| `stockCountsTableName` | Stock Counts | -- |
| `stockOrdersTableName` | Stock Orders | -- |
| `auditLogTableName` | Audit Log | -- |
| `itemNameField` | Item Name | Items |
| `itemBarStockField` | Bar Stock | Items |
| `itemCoreOrderField` | Core Order | Items |
| `itemActiveField` | Active | Items |
| `itemTypeField` | Item Type | Items |
| `sessionDateField` | Session Date | Count Sessions |
| `sessionStatusField` | Status | Count Sessions |
| `sessionStockCountsField` | Stock Counts | Count Sessions |
| `countItemField` | Item | Stock Counts |
| `countSessionField` | Count Session | Stock Counts |
| `countQuantityField` | Total On Hand | Stock Counts |
| `countPreviousField` | Previous Count | Stock Counts |
| `countNeedsReviewField` | Needs Review | Stock Counts |

### Waratah_GeneratePrepRun.gs

*Calculates prep shortfalls from Weekly Counts and generates Prep Tasks + Ingredient Requirements.*

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `itemsTableName` | Items | -- |
| `recipesTableName` | Recipes | -- |
| `recipeLinesTableName` | Recipe Lines | -- |
| `parTableName` | Par Levels | -- |
| `countsTableName` | Weekly Counts | -- |
| `runsTableName` | Prep Runs | -- |
| `tasksTableName` | Prep Tasks | -- |
| `reqTableName` | Ingredient Requirements | -- |
| `auditLogTableName` | Audit Log | -- |
| `itemTypeField` | Item Type | Items |
| `itemActiveField` | Active | Items |
| `itemBufferMultiplierField` | Buffer Multiplier | Items |
| `itemSupplierLinkField` | Supplier | Items |
| `itemSupplierNameLookupField` | Supplier Name | Items |
| `itemProductCategoryLookupField` | Product Category | Items |
| `itemOrderingStaffLookupField` | Ordering Staff | Items |
| `parItemLinkField` | Item Link | Par Levels |
| `parQtyField` | Par Qty | Par Levels |
| `countItemLinkField` | Item | Weekly Counts |
| `countQtyField` | Stock Count | Weekly Counts |
| `countConfirmedField` | Confirmed | Weekly Counts |
| `recipeProducesItemField` | Item Name | Recipes |
| `recipeYieldField` | Yield Qty | Recipes |
| `lineRecipeField` | Recipe | Recipe Lines |
| `lineComponentItemField` | Item | Recipe Lines |
| `lineQtyField` | Qty | Recipe Lines |
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
| `allowedTopLevelItemTypes` | Batch, Sub Recipe, Sub-recipe, Garnish, Other | Items.Item Type |

### Waratah_GenerateStockOrders.gs

*Generates stock orders from stocktake data, combining service shortfall with prep usage.*

| CONFIG Key | Airtable Field | Table |
|------------|---------------|-------|
| `itemsTableName` | Items | -- |
| `parLevelsTableName` | Par Levels | -- |
| `countSessionsTableName` | Count Sessions | -- |
| `stockCountsTableName` | Stock Counts | -- |
| `stockOrdersTableName` | Stock Orders | -- |
| `prepRunsTableName` | Prep Runs | -- |
| `ingredientReqTableName` | Ingredient Requirements | -- |
| `supplierTableName` | Supplier | -- |
| `auditLogTableName` | Audit Log | -- |
| `itemNameField` | Item Name | Items |
| `itemBarStockField` | Bar Stock | Items |
| `itemTypeField` | Item Type | Items |
| `itemSupplierField` | Supplier | Items |
| `itemParLevelsField` | Par Levels | Items |
| `itemOrderVolumeField` | Order Volume | Items |
| `itemUnitField` | Unit | Items |
| `parItemLinkField` | Item Link | Par Levels |
| `parQtyField` | Par Qty | Par Levels |
| `parActiveField` | Active | Par Levels |
| `countItemField` | Item | Stock Counts |
| `countQuantityField` | Total On Hand | Stock Counts |
| `sessionStatusField` | Status | Count Sessions |
| `sessionStockOrdersField` | Stock Orders | Count Sessions |
| `sessionOrderingExportStateField` | Ordering Export State | Count Sessions |
| `orderItemField` | Item | Stock Orders |
| `orderSessionField` | Count Session | Stock Orders |
| `orderOnHandField` | Total On Hand | Stock Orders |
| `orderPrepUsageField` | Prep Usage | Stock Orders |
| `orderParQtyField` | Prep Qty | Stock Orders |
| `orderServiceShortfallField` | Service Shortfall | Stock Orders |
| `orderCombinedField` | Combined Order Qty | Stock Orders |
| `orderSupplierStaticField` | Supplier Name (Static) | Stock Orders |
| `orderCategoryStaticField` | Product Category (Static) | Stock Orders |
| `orderStaffStaticField` | Ordering Staff (Static) | Stock Orders |
| `orderStatusField` | Status | Stock Orders |
| `supplierNameField` | Supplier Name | Supplier |
| `supplierCategoryField` | Product Category | Supplier |
| `supplierOrderingStaffField` | Ordering Staff | Supplier |

### GoogleDocsPrepSystem.gs

*GAS script that generates Google Docs from Airtable data and sends Slack notifications.*

| CFG Path | Airtable Field | Table |
|----------|---------------|-------|
| `airtable.tables.runs` | Prep Runs | -- |
| `airtable.tables.tasks` | Prep Tasks | -- |
| `airtable.tables.reqs` | Ingredient Requirements | -- |
| `airtable.tables.items` | Items | -- |
| `airtable.tables.recipes` | Recipes | -- |
| `airtable.tables.recipeLines` | Recipe Lines | -- |
| `airtable.tables.supplier` | Supplier | -- |
| `airtable.tables.parLevels` | Par Levels | -- |
| `airtable.tables.weeklyCounts` | Weekly Counts | -- |
| `airtable.tables.stockOrders` | Stock Orders | -- |
| `airtable.tables.countSessions` | Count Sessions | -- |
| `airtable.fields.itemName` | Item Name | Items |
| `airtable.fields.itemType` | Item Type | Items |
| `airtable.fields.itemUnit` | Unit | Items |
| `airtable.fields.itemBarStock` | Bar Stock | Items |
| `airtable.fields.recipeName` | Recipe Name | Recipes |
| `airtable.fields.recipeMethod` | Method | Recipes |
| `airtable.fields.rlRecipe` | Recipe | Recipe Lines |
| `airtable.fields.rlItem` | Item | Recipe Lines |
| `airtable.fields.rlQty` | Qty | Recipe Lines |
| `airtable.fields.parItem` | Item Link | Par Levels |
| `airtable.fields.parQty` | Prep Qty | Par Levels |
| `airtable.fields.wcItem` | Item | Weekly Counts |
| `airtable.fields.wcStockCount` | Stock Count | Weekly Counts |
| `airtable.fields.wcConfirmed` | Confirmed | Weekly Counts |
| `airtable.fields.wcCountDate` | Count Date | Weekly Counts |
| `airtable.fields.supplierName` | Supplier Name | Supplier |
| `airtable.fields.supplierOrderingStaff` | Ordering Staff | Supplier |
| `airtable.fields.supplierEmail` | Email | Supplier |
| `airtable.fields.reqItem` | Item Link | Ingredient Requirements |
| `airtable.fields.reqQty` | Total Qty Needed | Ingredient Requirements |
| `airtable.fields.reqSupplierNameStatic` | Supplier Name (Static) | Ingredient Requirements |
| `airtable.fields.reqStaffStatic` | Ordering Staff (Static) | Ingredient Requirements |
| `airtable.fields.soItem` | Item | Stock Orders |
| `airtable.fields.soSession` | Count Session | Stock Orders |
| `airtable.fields.soOnHand` | Total On Hand | Stock Orders |
| `airtable.fields.soPrepUsage` | Prep Usage | Stock Orders |
| `airtable.fields.soParQty` | Prep Qty | Stock Orders |
| `airtable.fields.soServiceShortfall` | Service Shortfall | Stock Orders |
| `airtable.fields.soCombinedQty` | Combined Order Qty | Stock Orders |
| `airtable.fields.soSupplierStatic` | Supplier Name (Static) | Stock Orders |
| `airtable.fields.soCategoryStatic` | Product Category (Static) | Stock Orders |
| `airtable.fields.soStaffStatic` | Ordering Staff (Static) | Stock Orders |
| `airtable.fields.soStatus` | Status | Stock Orders |
| `airtable.fields.csStatus` | Status | Count Sessions |
| `airtable.fields.csDate` | Session Date | Count Sessions |
| `airtable.fields.csName` | Session Name | Count Sessions |
| `airtable.fields.csOrderingExportState` | Ordering Export State | Count Sessions |

---

## Item Type Values Used by Scripts

*Which scripts care about which Item Type values — and what they do with them.*

### Waratah_ClearWeeklyCount.gs
- **Filter:** `["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]`
- **Action:** Creates placeholder Weekly Count rows for these item types only

### Waratah_GeneratePrepRun.gs
- **`allowedTopLevelItemTypes`:** `Set(["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"])`
- **`subRecipeItemTypes`:** `Set(["Sub Recipe", "Sub-recipe"])`
- **Action:** Generates Prep Tasks for items matching these types. Sub-recipes get ingredient explosion.

### GoogleDocsPrepSystem.gs
- **`batchVariants`:** `Set(["Batch", "Sub Recipe"])` — items that appear in Batching List and Ingredient Prep List
- **`ingredientPrepOnly`:** `Set(["Garnish", "Other"])` — items that appear in Ingredient Prep List only
- **Ordering filter:** Skips `batchVariants` (made in-house, not ordered)

### Stock count scope
- **Filter:** `Core Order = true` on Items table (any Item Type)
- **Used by:** `Waratah_InitStockCount.gs`, `Waratah_GenerateStockOrders.gs`

---

## Differences from Sakura Schema

*Key structural and data differences between the two venue bases.*

| Feature | Sakura House | The Waratah |
|---------|-------------|-------------|
| **Base ID** | `appNsFRhuU47e9qlR` | `appfcy14ZikhKZnRS` |
| **Recipe name field** | `Recipe Name` (singleLineText) | `Item Name` (linked record → Items) |
| **Item Name field** | singleLineText (primary) | singleLineText (primary) |
| **Ordering staff** | Gooch, Sabs (split ordering docs) | Evan (sole operator, combined doc) |
| **Item Type values** | Batch, Sub Recipe, Sub-recipe, Ingredient, Garnish, Other, in | Batch, Sub Recipe, Sub-recipe, Ingredient, Garnish, Other, Spirit, Wine, Beer, Mixer, RTD |
| **Core Order checkbox** | No | Yes (~59 items — counting scope filter) |
| **Bar Stock checkbox** | No | Yes (~414 items) |
| **Order Volume field** | No (uses Order Size) | Yes (ml per bottle/case, for unit conversion) |
| **Count Sessions table** | No | Yes (orchestrates stock count pipeline) |
| **Stock Counts table** | No | Yes (per-item bar stock tallies with 5 areas) |
| **Stock Orders table** | No | Yes (generated order quantities per item) |
| **Handovers table** | Yes | No |
| **Recipe Database table** | Yes | No |
| **Staff Shift Logs table** | Yes | No |
| **Prep Run Requests table** | Yes | No |
| **Ordering doc type** | 2 per-staff docs (Gooch + Sabs) | 1 combined doc |
| **Weekly cycle** | Fri AM clear → Sat AM reset → Sat shift | Sat AM clear → Sun stocktake → Mon AM automation |
| **Script prefix** | None | `Waratah_` for Airtable scripts |

---

*Last generated: 2026-03-22. Source of truth: live Airtable base `appfcy14ZikhKZnRS` + script CONFIG blocks.*
