# Waratah_GeneratePrepRun.gs -- GeneratePrepRun Explainer

**Script:** `Waratah_GeneratePrepRun.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Scheduled automation -- Sunday 11:15pm (15 minutes after FinaliseCount)

---

## What It Does

This is the most complex script in the system. It calculates what needs to be prepped based on current stock levels and par levels, then creates the tasks and ingredient lists that become the prep documents.

In summary, it:

1. Finds the latest verified stocktake from Weekly Counts
2. Compares stock on hand against par levels to find shortfalls
3. Looks up recipes for each item that needs prepping
4. Cascades sub-recipe requirements (if a batch needs a sub-recipe, and that sub-recipe also needs prepping, it cascades down)
5. Creates **Prep Task** records (what to make, how much)
6. Creates **Ingredient Requirement** records (what ingredients are needed, how much of each)
7. Applies Buffer Multiplier to Sub Recipe suggested quantities

---

## When It Runs

- **Normal cycle:** Sunday 11:15pm (automated), 15 minutes after FinaliseCount finalises the Weekly Counts
- **Can be triggered manually** via the automation or the Prep Run Requests table

---

## Inputs (Automation Inputs)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `requestId` | string | `null` | Record ID from the Prep Run Requests table (for tracking) |
| `prepWeek` | date/time | `null` | Override the Prep Week date on the created Prep Run |
| `dryRun` | boolean | `false` | Logs what would happen without creating records |
| `allowDuplicates` | boolean | `false` | When `true`, creates a new Prep Run even if one already exists for this stocktake |

---

## Key Concepts

### Shortfall Calculation
For each item:
```
Shortfall = Par Qty - Stock On Hand
```
If shortfall is <= 0, the item has enough stock and no prep task is created.

### Allowed Item Types
Only items with these types get top-level prep tasks:
- **Batch** -- the main prep items (e.g., Spiced Rum Syrup, Citrus Oleosaccharum)
- **Sub Recipe** and **Sub-recipe** -- components used by batches (e.g., Demerara Syrup, Lime Cordial)
- **Garnish** -- garnish prep (e.g., dehydrated citrus wheels)
- **Other** -- miscellaneous prep items

Garnish and Other items get prep tasks but do NOT appear in ordering documents (they are made in-house from purchased ingredients, but the ordering system only handles bar stock).

### Two-Pass Sub-Recipe Cascade
This is the most important algorithm in the system.

**Pass 1 (demand accumulation):** The script starts with all top-level batch tasks and processes their recipes. For each recipe line:
- If the component is a sub-recipe, the demand is accumulated (not immediately turned into a task)
- If the component is an ingredient, the demand is accumulated for ingredient requirements
- Sub-recipe components may themselves have recipes, so the cascade continues recursively

The key insight is that a sub-recipe might be used by MULTIPLE parent batches. Pass 1 ensures all demand is collected before deciding how much to make.

**Pass 2 (task creation):** After the queue is fully drained (all demand settled), the script creates tasks for every sub-recipe with positive net demand. The net demand is the maximum of:
- `(total demand from all parents) - (stock on hand)` (demand-based)
- `(par level) - (stock on hand)` (par-based)

This ensures sub-recipes are never under-produced just because parent demand is low.

### Buffer Multiplier
Items on the Items table can have a `Buffer Multiplier` field (e.g., 1.5 means "make 50% extra"). For Sub Recipe items, the script calculates:
```
Suggested Qty = Target Qty x Buffer Multiplier
```
This is written to the `Suggested Qty (Buffer)` field on the Prep Task record. The prep docs can then show both the exact target and the suggested (buffered) quantity.

### Duplicate Detection
By default, the script checks if a Prep Run already exists for the same stocktake timestamp (by looking for `STOCKTAKE_MINUTE_ISO=...` in the run's Notes field). If found, it rebuilds that run by deleting its existing tasks and requirements, then recreating them. Set `allowDuplicates = true` to force creation of a new run.

---

## Phase-by-Phase Walkthrough

### Phase 1: Find Latest Verified Stocktake
Scans the Weekly Counts table for records where:
- `Confirmed` = `true`
- `Count Source` = `"Stocktake (Verified)"`

Finds the most recent timestamp among these records. All counts within the same minute window are considered part of the same stocktake.

If no verified stocktake exists, the script throws an error.

### Phase 2: Build Stock Snapshot
Iterates through all verified count records matching the stocktake timestamp. Builds a map of `itemId --> quantity on hand`. If any verified record has a blank Stock Count, the script throws an error (this should have been caught by FinaliseCount, but is checked again as a safety measure).

### Phase 3: Load Par Levels
Reads the Par Levels table to build a map of `itemId --> par quantity`. Each item has one par level that represents the target stock level.

### Phase 4: Load Items Data
Fetches all items with their type, active status, supplier info, product category, ordering staff, and Buffer Multiplier. Builds lookup maps for use in later phases.

### Phase 5: Load Recipes
Fetches all recipes. Each recipe is linked to the item it produces via the `Item Name` linked-record field. Builds a map of `producedItemId --> { recipeId, yieldQty }`.

### Phase 6: Load Recipe Lines
Fetches all recipe lines (the ingredient list for each recipe). Each line links to a recipe and a component item, with a quantity per batch. Validates that all component items still exist in the Items table (catches broken links).

### Phase 7: Find or Create Prep Run
Checks if a Prep Run already exists for this stocktake timestamp. If found (and `allowDuplicates` is false), uses the existing run. Otherwise, creates a new Prep Run record.

### Phase 8: Delete Existing Children (if rebuilding)
If an existing run was found, deletes all its Prep Tasks and Ingredient Requirements before regenerating them.

### Phase 9: Generate Prep Tasks (The Core Algorithm)

**Top-level tasks:** For each active item of an allowed type (Batch, Sub Recipe, Sub-recipe, Garnish, Other):
```
shortfall = par[item] - onHand[item]
```
If `shortfall > 0`, a task is created. The recipe and yield quantity are looked up.

**Sub-recipe cascade (Pass 1):** For each task's recipe, its recipe lines are processed:
- Each component's demand is accumulated in `requiredQtyByItemId`
- If the component is a sub-recipe, its net demand (demand - stock on hand - already scheduled) is queued for its own cascade
- This continues until the queue is empty

**Cycle protection:** The queue has a maximum of 20,000 operations. If exceeded, the script throws an error indicating a possible cyclic dependency in recipes.

**Sub-recipe task creation (Pass 2):** After the queue drains, every sub-recipe with positive net demand gets a task. The net demand considers both parent-driven demand and par-level shortfall.

### Phase 10: Create Task Records
Writes Prep Task records to Airtable. For Sub Recipe items, also calculates the Suggested Qty (Target Qty x Buffer Multiplier).

### Phase 11: Generate Ingredient Requirements
For each task with a recipe, scales the recipe lines and creates Ingredient Requirement records. Includes static snapshot fields (Supplier Name, Product Category, Ordering Staff) for the ordering doc.

### Phases 12-16: User Capture, Timing, Request Update, Summary, Audit Log
Standard housekeeping: captures the triggering user, calculates execution time, updates the Prep Run Request status (if applicable), logs the summary, and writes to the Audit Log.

---

## Airtable Tables Written To

| Table | What Gets Created |
|-------|------------------|
| **Prep Runs** | One record per run (links to all tasks and requirements) |
| **Prep Tasks** | One record per item to prep (Item Needed, Recipe Used, Target Qty, Batches Needed, Suggested Qty) |
| **Ingredient Requirements** | One record per ingredient per recipe (Item Link, Recipe Link, Total Qty Needed, Supplier static fields) |

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "No VERIFIED stocktake found" | FinaliseCount has not run, or no confirmed counts exist | Run FinaliseCount first, or check that Weekly Counts have `Confirmed = true` and `Count Source = "Stocktake (Verified)"` |
| "Broken Recipe Lines detected" | Recipe Lines reference items that no longer exist in the Items table | Open Recipe Lines table, find the broken links, and fix or delete them |
| "Exceeded maxQueueOps" | Cyclic recipe dependency (Recipe A needs B, B needs A) | Check your recipes for circular references and fix them |
| Zero tasks generated | All items are at or above par level | This is normal if everything is well-stocked. No prep needed |
| Wrong quantities | Par levels or stock counts are incorrect | Check the Par Levels and Weekly Counts tables for accuracy |
| Missing ingredient requirements | Recipe lines are missing or have zero quantities | Check Recipe Lines for the affected recipe |

---

## How to Check If It Worked

1. Open the **Prep Runs** table -- you should see a new run with today's date
2. Open the **Prep Tasks** table -- you should see tasks linked to the new run, with Target Qty and Batches Needed values
3. Open the **Ingredient Requirements** table -- you should see ingredient records linked to the new run
4. Check the **Audit Log** for "WARATAH - GENERATE PREP RUN" with task and requirement counts
5. The Prep Run's Notes field should contain the stocktake timestamp and ISO date

---

## What Happens Next

After this script runs, `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` marks the Prep Run for export by setting `Export Request State = REQUESTED`. GAS then polls for this state and generates the Ingredient Prep List and Batching Run Sheet documents.
