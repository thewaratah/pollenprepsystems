# Stock Count + Ordering System — The Waratah

**Status:** PLAN ONLY — Not yet implemented
**Date:** 2026-03-07 (revised after multi-agent review)
**Owner:** Andie (primary counter/orderer for alcoholic stock)
**Scope:** Spirits, wines, beers across 5 storage locations
**Cadence:** Tuesdays (independent of Monday prep cycle)

---

## 1. Problem Statement

The PREP system calculates ingredient quantities needed for batches and sub-recipes (prep usage). But spirits, wines, and beers are also consumed through general bar service — poured neat, in rounds, etc. Staff cannot easily combine "prep used X bottles of tequila" with "service used Y bottles" to get a total ordering quantity.

**Current state:**
- Monday: Blade counts prep items -> FinaliseCount -> GeneratePrepRun -> Ingredient Requirements + ordering docs
- Tuesday: Andie manually counts alcoholic stock across 5 locations, mentally combines with prep data, orders by hand

**Desired state:**
- Monday: Prep cycle runs independently (no changes)
- Tuesday: Andie opens a structured counting interface, counts stock by location, sees prep-calculated usage alongside her counts, and gets a combined ordering quantity per item

---

## 2. Architecture Overview

```
                     +------------------+
                     |      Items       |
                     | + Bar Stock [x]  |  <-- NEW checkbox field
                     +--------+---------+
                              |
               +--------------+--------------+
               |                             |
      +--------v----------+       +----------v-----------+
      |  Weekly Counts     |       |   Stock Counts        |
      |  (Bar Stock=false) |       |   (Bar Stock=true)    |
      |  Blade, Mon        |       |   Per-location, Tue   |
      +--------+-----------+       +----------+-----------+
               |                              |
      +--------v----------+       +-----------v-----------+
      | GeneratePrepRun    |       | GenerateStockOrders   |
      | (unchanged)        |       | aggregate + par calc  |
      +--------+-----------+       +-----------+----------+
               |                               |
      +--------v-----------+       +-----------v----------+
      | Ingredient          |       |   Stock Orders        |
      | Requirements        |       |   + Prep Usage col    |
      | (excludes Bar Stock)|       |   from Ingr. Req.     |
      +--------+------------+       +-----------+----------+
               |                                |
               |     +-------------------------+|
               |     |                          |
      +--------v-----v---+          +-----------v----------+
      | Blade's Order Doc |          | Andie's Bar Stock    |
      | (prep only)       |          | Order Doc (combined) |
      +-------------------+          +----------------------+
```

**Key principles:**
- Two paths share `Items` and `Par Levels` tables but are otherwise independent
- No changes to existing prep scripts (except one defensive skip-list addition to `buildOrdering_`)
- Dual-use items (e.g., tequila used in both prep and bar service) route through the bar stock path for ordering — excluded from prep ordering docs to prevent double-ordering

---

## 3. Critical Design Decisions (from multi-agent review)

### 3.1 `Bar Stock` Checkbox — NOT Item Type Change

**Problem discovered:** `Waratah_GeneratePrepRun.gs` line ~1070 checks each recipe component's Item Type against the literal string `"Ingredient"`. If a dual-use item (e.g., Tequila Blanco) is changed from `"Ingredient"` to `"Spirit"`, it silently disappears from Ingredient Requirements. The Margarita batch still gets a Prep Task, but nobody is told to order the tequila for it. **Silent data loss.**

**Solution:** Add a `Bar Stock` checkbox to Items instead. Dual-use items keep `Item Type = "Ingredient"` and get `Bar Stock = true`. The stock counting system filters on `{Bar Stock} = TRUE`. Prep system is untouched.

| Item | Item Type | Bar Stock | Appears in... |
|------|-----------|-----------|---------------|
| Cornflour | Ingredient | false | Prep ordering only |
| Tequila Blanco | Ingredient | **true** | Both prep Ingredient Req. AND bar stock count |
| Premium Whisky (no recipes) | Spirit | **true** | Bar stock count only |
| Margarita batch | Batch | false | Prep tasks only |

### 3.2 Par Levels = "Service-Only" (prevents double-counting)

**Problem discovered:** The formula `Combined = MAX(0, Par - OnHand) + Prep Usage` double-counts if par levels are set to cover total consumption (service + prep). E.g., par = 8 (covers 5 service + 3 prep), on hand = 3, prep = 2 -> system says order 7, but correct answer is 5.

**Solution:** Bar stock par levels represent **service-only** targets — how much Andie needs on the shelf for bar service between order cycles, excluding prep. Prep usage is then correctly additive on top.

Par Levels table gets a new `Par Type` field ("Prep" / "Bar Stock") so each system reads its own pars.

### 3.3 Bar Stock Items Excluded from Prep Ordering Docs

**Problem discovered:** A dual-use item appears in both Monday's Ingredient Requirements (-> Andie's prep ordering doc) AND Tuesday's Stock Orders. Without coordination, Andie orders the prep usage twice.

**Solution:** Add bar stock Item Types to the skip list in `GoogleDocsPrepSystem.gs`'s `buildOrdering_` function. Items with `Bar Stock = true` are excluded from prep ordering docs. Their prep usage is folded into the Tuesday stock order instead.

---

## 4. Resolved Questions

| Question | Answer |
|----------|--------|
| What unit does Andie count in? | **Units** (whole + decimal). ML size is already applied to each item (bottles 200-1000ml, kegs 50000ml). No unit conversion needed. |
| Do all items exist at all 5 locations? | **Apply all locations to all stock.** Full cartesian product (item x location). Andie enters 0 where item isn't present. |
| Par levels already exist? | **Yes** — Andie already has par levels. Data entry into Airtable required in Phase 1. |
| Supplier data in Airtable? | **Yes** — suppliers already exist in the Supplier table. Bar stock items just need linking. |
| Mixers included? | Deferred to Phase 4. |
| Case-size rounding? | Deferred to Phase 4. |

---

## 5. Airtable Schema Changes

### 5.1 Changes to Existing Tables

#### `Items` — Two new fields

| Field | Type | Notes |
|-------|------|-------|
| `Bar Stock` | **Checkbox** | true = counted by Andie on Tuesdays. Core routing field. |
| `Shelf Position` | Number | Physical ordering within location for counting UX |

#### `Items` — New Item Type values (for pure bar stock items only)

| New Value | Purpose |
|-----------|---------|
| `Spirit` | Vodka, gin, rum, whiskey — items with NO prep recipes |
| `Wine` | Red, white, sparkling, fortified |
| `Beer` | Beers, ciders, seltzers |
| `Mixer` | Tonic, soda, juice (Phase 4) |
| `RTD` | Ready-to-drink (if applicable) |

**Important:** Dual-use items (used in both prep recipes AND bar service) keep `Item Type = "Ingredient"` with `Bar Stock = true`. Only items with zero recipe usage get the new Item Type values.

**Zero risk to existing scripts** — `Waratah_GeneratePrepRun.gs` and `Waratah_ClearWeeklyCount.gs` filter by their own `allowedTopLevelItemTypes` sets. New types are invisible. The `"Ingredient"` check on recipe line components (line ~1070) is also unaffected because dual-use items remain typed as `"Ingredient"`.

#### `Par Levels` — One new field

| Field | Type | Notes |
|-------|------|-------|
| `Par Type` | Single select | "Prep" / "Bar Stock" — distinguishes which system uses this par |

Existing prep par records get `Par Type = "Prep"`. New bar stock pars get `Par Type = "Bar Stock"`.

### 5.2 New Tables

#### `Storage Locations` (reference table — 5 records)

| Field | Type | Notes |
|-------|------|-------|
| `Location Name` | Text (primary) | "Public Bar", "Terrace Bar", "Banquettes", "B1", "Backbars" |
| `Sort Order` | Number | Controls display order: 1, 2, 3, 4, 5 |
| `Active` | Checkbox | Allows deactivation without deleting history |
| `Notes` | Long text | Optional location description |

#### `Count Sessions` (one per Tuesday counting event)

| Field | Type | Notes |
|-------|------|-------|
| `Session Date` | Date | The Tuesday date |
| `Session Name` | Formula | `"Stock Count - " & DATETIME_FORMAT({Session Date}, 'DD/MM/YYYY')` |
| `Status` | Single select | "Not Started", "In Progress", "Completed", "Verified" |
| `Counted By` | Single select | "Andie" |
| `Stock Counts` | Linked (reverse) | Auto-populated |
| `Stock Orders` | Linked (reverse) | Auto-populated after order generation |
| `Notes` | Long text | Session-level notes |

#### `Stock Counts` (one per item per location per session)

| Field | Type | Notes |
|-------|------|-------|
| `Item` | Linked record -> Items | The spirit/wine/beer |
| `Location` | Linked record -> Storage Locations | Where counted |
| `Count Session` | Linked record -> Count Sessions | Groups counts |
| `Quantity` | Number (decimal) | Units on hand (e.g., 2.5 = 2 full + half open) |
| `Previous Count` | Number | Last session's quantity for this item+location (usage tracking) |
| `Needs Review` | Checkbox | Flag suspicious counts for review |
| `Notes` | Long text | "Half bottle open", etc. |
| `Item Name (Lookup)` | Lookup from Item | For display in views |
| `Location Name (Lookup)` | Lookup from Location | For display in views |
| `Unit (Lookup)` | Lookup from Item.Unit | Auto-display unit |

#### `Stock Orders` (calculated ordering output)

| Field | Type | Notes |
|-------|------|-------|
| `Item` | Linked record -> Items | What to order |
| `Count Session` | Linked record -> Count Sessions | Source session |
| `Total On Hand` | Number | Sum of all location counts for this item |
| `Prep Usage` | Number | SUMmed from latest Ingredient Requirements across all recipes |
| `Par Qty` | Number | Snapshot of bar stock par level |
| `Service Shortfall` | Number | `MAX(0, Par Qty - Total On Hand)` |
| `Combined Order Qty` | Number | `Service Shortfall + Prep Usage` |
| `Supplier Name (Static)` | Text | Snapshot from Items |
| `Product Category (Static)` | Text | Snapshot from Items |
| `Ordering Staff (Static)` | Text | Always "Andie" for bar stock |
| `Status` | Single select | "Pending", "Ordered", "Received" |
| `Notes` | Long text | |

### 5.3 What Does NOT Change

- `Weekly Counts` — continues to be prep-only (Blade, Mondays)
- `Prep Runs` / `Prep Tasks` / `Ingredient Requirements` — untouched
- `Recipes` / `Recipe Lines` — untouched
- `Supplier` — no schema change (bar stock items already have suppliers)

---

## 6. New Airtable Automation Scripts

### 6.1 `Waratah_InitStockCount.gs`

**Trigger:** Manual (Andie clicks a button) or scheduled (Tuesday 8am)
**Purpose:** Create a new Count Session + placeholder Stock Count records + archive old sessions

**Logic:**
1. Archive sessions older than 4 weeks (delete session + cascade to its Stock Counts and Stock Orders)
2. Create a `Count Sessions` record with today's date, Status = "Not Started"
3. Fetch all active Items where `Bar Stock = true`
4. Fetch all active Storage Locations
5. Fetch previous session's Stock Counts (for `Previous Count` field)
6. For each (item, location) pair: create a `Stock Counts` record with `Quantity = null`, `Previous Count` = last session's value for same item+location
7. Update session Status to "In Progress"

**Estimated records per session:** ~100 items x 5 locations = ~500 placeholder records
**API calls:** ~50 batch creates (10 per call) = ~15 seconds. Within Airtable 30s limit.

### 6.2 `Waratah_ValidateStockCount.gs`

**Trigger:** Automation on Count Session Status change to "Completed"
**Purpose:** Validate counts before order generation

**Logic:**
1. Fetch all Stock Counts for the session
2. Check all items have a count (no nulls remaining) — null = "not checked" vs 0 = "checked, none found"
3. Flag outliers: any count > 200% of par level gets `Needs Review = true`
4. Validate session date is today (prevent accidental re-run of old sessions)
5. If valid: trigger `GenerateStockOrders`
6. If invalid: log errors, keep session as "Completed" (not "Verified"), alert Andie

### 6.3 `Waratah_GenerateStockOrders.gs`

**Trigger:** Called by ValidateStockCount after successful validation
**Purpose:** Aggregate counts and calculate ordering quantities

**Logic:**
1. Find latest Count Session with Status = "Completed" (validated)
2. Fetch all Stock Counts for that session
3. Aggregate: `totalOnHand[itemId] = SUM(quantities across all locations)`
4. Fetch Par Levels where `Par Type = "Bar Stock"`
5. Fetch latest Ingredient Requirements from **current week's** Prep Run:
   - Find most recent Prep Run where `Prep Week` is within the last 7 days
   - Fetch its Ingredient Requirements
   - **SUM across all recipes** for each item (not single lookup — same item can appear in multiple recipes)
   - If no Prep Run exists this week: `prepUsage = 0` for all items, log warning
6. For each bar stock item:
   - `serviceShortfall = MAX(0, parQty - totalOnHand)`
   - `prepUsage = SUM(ingredientRequirements for this itemId) || 0`
   - `combinedOrderQty = serviceShortfall + prepUsage`
7. Create Stock Orders records (only where `combinedOrderQty > 0`)
8. Update session Status to "Verified"
9. Write to Audit Log

---

## 7. GAS Export Pipeline

### 7.1 New Google Doc: "Bar Stock Ordering Run Sheet — W.E. DD/MM/YYYY"

Add a self-contained export function to `GoogleDocsPrepSystem.gs` (or parallel file). Uses the same template engine pattern as existing docs.

**Document structure:**
```
BAR STOCK ORDERING RUN SHEET — W.E. 16/03/2026
Counted by: Andie
Session: Stock Count - 11/03/2026

[Grouped by Supplier]

--- VANGUARD LUXURY BRANDS ---
  Hendricks Gin 700ml  | On Hand: 3.5 | Par: 6 | Prep: 0.5 | Order: 3
  Tanqueray 700ml      | On Hand: 2   | Par: 5 | Prep: 1   | Order: 4
  ...

--- PARAMOUNT LIQUOR ---
  ...

[ITEMS BELOW PAR -- NO SUPPLIER]
  ...
```

**Trigger mechanism:** New polling function (same pattern as `Waratah_GeneratePrepSheet_TimeBasedPolling.gs`) checks Count Sessions for `Status = "Verified"` + `Export Requested = true`. Or: triggered directly by `GenerateStockOrders` via GAS web app endpoint.

**Template:** Create a new Google Docs template with Waratah branding (logo + watermark), matching existing prep doc templates.

### 7.2 Slack Notification

Use existing Slack webhook pattern (`SLACK_WEBHOOK_WARATAH_ANDIE`) to send a link to the generated doc. Same Block Kit structure as current prep ordering notifications.

### 7.3 Modify `buildOrdering_` in GoogleDocsPrepSystem.gs

Add `Bar Stock = true` items to the skip list so they no longer appear in Andie's prep ordering doc. This prevents double-ordering for dual-use items.

---

## 8. Andie's Workflow (Tuesday)

### Step-by-step:

1. **8:00am** -- `Waratah_InitStockCount` runs automatically
   - Archives old sessions (>4 weeks)
   - Creates session + placeholder records for all bar stock items x all locations
   - Populates `Previous Count` from last session

2. **8:00am-11:00am** -- Andie walks each location and enters counts
   - Opens Airtable view "Count by Location" (grouped by location, sorted by Shelf Position)
   - Walks to Public Bar -> fills in quantities -> moves to Terrace Bar -> etc.
   - Counts in **tenths** for partial bottles (2.3 = 2 full + ~1/3 open)
   - Uses "Missing Counts" view to check nothing was skipped
   - Items not present at a location: enters 0 (null = "not checked" and blocks completion)

3. **~11:00am** -- Andie marks the Count Session as "Completed"
   - Reviews "Session Review" view for sanity check

4. **~11:00am** -- `Waratah_ValidateStockCount` runs automatically
   - Checks no nulls remain, flags outliers
   - If valid: triggers order generation

5. **~11:01am** -- `Waratah_GenerateStockOrders` runs
   - Calculates combined ordering quantities (service shortfall + prep usage)
   - Creates Stock Order records
   - Marks session "Verified"

6. **~11:05am** -- GAS export generates ordering doc + Slack notification
   - Andie receives the doc link in Slack
   - Doc shows: on-hand totals, par levels, prep usage (from Monday), and final order quantity per item grouped by supplier

7. **11:05am onwards** -- Andie places orders with suppliers using the doc

### Airtable Views for Andie:

| View Name | Table | Purpose |
|-----------|-------|---------|
| "Count by Location" | Stock Counts | Primary counting -- grouped by Storage Location, sorted by Shelf Position |
| "Missing Counts" | Stock Counts | Filter: current session AND Quantity is empty |
| "Session Review" | Stock Counts | Flat list, sorted A-Z, for final review before marking Complete |
| "Current Orders" | Stock Orders | Ordering list grouped by supplier, filter: latest session |
| "Order History" | Stock Orders | All past sessions for trend analysis |
| "Bar Stock Items" | Items | Filter: Bar Stock = true AND Status = Active |

---

## 9. Prep Usage Integration

The key innovation: **Stock Orders includes a `Prep Usage` column** that pulls from Monday's Ingredient Requirements.

### How it works:

1. Monday PM: `GeneratePrepRun` creates Ingredient Requirements (existing flow, unchanged)
2. Tuesday: `GenerateStockOrders` finds the current week's Prep Run, fetches its Ingredient Requirements
3. For each bar stock item that also appears as a recipe component:
   - `Prep Usage` = SUM of `Total Qty Needed` across all Ingredient Requirements for this item
   - `Combined Order Qty` = service shortfall + prep usage
4. Items with `Bar Stock = true` are **excluded** from Andie's prep ordering doc (via `buildOrdering_` skip list)

### Example (par levels are service-only):

| Item | On Hand (all locations) | Par (service) | Service Shortfall | Prep Usage (Mon) | Combined Order |
|------|------------------------|---------------|-------------------|------------------|----------------|
| Tequila Blanco 700ml | 3 | 5 | 2 | 2 (Margarita batch) | **4** |
| Hendricks Gin 700ml | 4 | 6 | 2 | 0 | **2** |
| Angostura Bitters 200ml | 1 | 2 | 1 | 0.5 (Old Fashioned) | **1.5** |

### Edge cases:

- **No Monday Prep Run:** `prepUsage = 0` for all items. Warning logged. Andie sees service shortfall only.
- **Item in prep but NOT bar stock:** Stays in prep ordering doc (Ingredient type, Bar Stock = false). Not affected.
- **Item in bar stock but NOT prep:** `prepUsage = 0`. Order = service shortfall only.
- **Prep Run rebuilt mid-week:** Script always reads from the latest Prep Run by date. Safe.

---

## 10. Phase Plan

### Phase 1: Foundation (Week 1) -- DATA ENTRY

- [ ] Add `Bar Stock` checkbox field to Items table
- [ ] Add `Shelf Position` number field to Items table
- [ ] Add `Par Type` single select to Par Levels table ("Prep" / "Bar Stock")
- [ ] Add new Item Type values: Spirit, Wine, Beer (Mixer, RTD deferred)
- [ ] Mark existing dual-use items with `Bar Stock = true` (keep Item Type = "Ingredient")
- [ ] Add pure bar stock items with Item Type = Spirit/Wine/Beer and `Bar Stock = true`
- [ ] Link all bar stock items to their Suppliers (already in Airtable)
- [ ] Enter Andie's par levels with `Par Type = "Bar Stock"` (she already has these)
- [ ] Tag existing prep par levels with `Par Type = "Prep"`
- [ ] Create `Storage Locations` table (5 records: Public Bar, Terrace Bar, Banquettes, B1, Backbars)
- [ ] Create `Count Sessions` table
- [ ] Create `Stock Counts` table (with Previous Count + Needs Review fields)
- [ ] Create `Stock Orders` table
- [ ] Build 6 Airtable views for Andie

### Phase 2: Automation Scripts (Week 2)

- [ ] Write `Waratah_InitStockCount.gs` (session + placeholders + archival + Previous Count)
- [ ] Write `Waratah_ValidateStockCount.gs` (null check, outlier flagging, date guard)
- [ ] Write `Waratah_GenerateStockOrders.gs` (aggregation + prep usage SUM + Audit Log)
- [ ] Add all 3 new scripts to `.claspignore` (P0 requirement)
- [ ] Follow existing CONFIG/INPUT/safeField_/batchCreate_/writeAuditLog_ patterns
- [ ] Test on copy of Airtable base with sample data

### Phase 3: Export Pipeline (Week 3)

- [ ] Create Google Docs template for bar stock ordering (Waratah branding)
- [ ] Add bar stock doc export function to GAS (self-contained in GoogleDocsPrepSystem.gs)
- [ ] Add polling trigger mechanism for bar stock export
- [ ] Add Slack notification (SLACK_WEBHOOK_WARATAH_ANDIE)
- [ ] **Modify `buildOrdering_`** -- skip items with `Bar Stock = true` from prep ordering docs
- [ ] End-to-end test: init -> count -> validate -> generate -> export -> Slack

### Phase 4: Optimisation (Week 4+)

- [ ] Location-aware placeholders (sparse model based on previous counts where Quantity > 0)
- [ ] Case-size rounding (`Case Size` field on Items, `CEILING(orderQty, caseSize)`)
- [ ] Usage trend tracking (week-over-week deltas from Previous Count)
- [ ] Include Mixers (add to Bar Stock items)
- [ ] Combined "Master Order" doc merging prep + bar stock into one supplier-grouped document
- [ ] Mobile-optimised counting web app at `/count` on Knowledge Platform (offline-first)
- [ ] Automated par level review alerts (flag items where usage deviates >30% from par)

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dual-use items double-ordered | **P0** | `Bar Stock` checkbox + exclude from prep ordering docs via `buildOrdering_` |
| Par level semantics misunderstood | **P1** | Document "service-only" definition; `Par Type` field distinguishes prep vs bar stock |
| Item Type change breaks prep | **P0** | Avoided entirely -- dual-use items keep `Item Type = "Ingredient"` |
| Prep Run missing on Tuesday | **P1** | Date guard (7-day window) + graceful fallback (prepUsage = 0, warning logged) |
| Ingredient Req. not aggregated properly | **P1** | SUM across all recipes per item, not single lookup |
| 500 records/session = Airtable bloat | **P2** | Archival built into InitStockCount (4-week retention, ~2000 records max) |
| Airtable 30s script timeout | **P2** | Monitor; split into two automations if needed |
| Null vs 0 confusion | **P2** | ValidateStockCount blocks on nulls; 0 = "checked, none found" |
| RecipeScaler shows bar stock items | **P3** | Filter `getRecipeList()` to exclude items without recipes (future) |

---

## 12. Files That Will Be Created/Modified

### New Files (Airtable automations)
- `Waratah_InitStockCount.gs` -- session + placeholder creation + archival
- `Waratah_ValidateStockCount.gs` -- count validation before order generation
- `Waratah_GenerateStockOrders.gs` -- aggregation + ordering calculation

### Modified Files
- `GoogleDocsPrepSystem.gs` -- add bar stock ordering doc generation + Slack notification + modify `buildOrdering_` to skip Bar Stock items
- `.claspignore` -- add 3 new Waratah_*.gs scripts to exclusion list

### No Changes to Existing Automation Scripts
- `Waratah_ClearWeeklyCount.gs` -- untouched
- `Waratah_FinaliseCount.gs` -- untouched
- `Waratah_GeneratePrepRun.gs` -- untouched
- `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` -- untouched
- `RecipeScaler.gs` -- untouched
- `FeedbackForm.gs` -- untouched
