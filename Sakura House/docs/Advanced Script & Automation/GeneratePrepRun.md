# GeneratePrepRun.gs -- Script Explainer

**Version:** 3.0
**Runs in:** Airtable Automation
**Trigger:** Interface button ("Generate Prep Run")
**Last Updated:** 2026-03-22

---

## What It Does

GeneratePrepRun is the most complex script in the system. It:

1. Finds the latest verified stocktake
2. Calculates what is below par (shortfalls)
3. Applies a dynamic reorder point system (v3.0) to decide which items actually need prep
4. Determines how many batches of each recipe to make
5. Cascades demand down through sub-recipes
6. Creates **Prep Task** records (one per item to produce)
7. Creates **Ingredient Requirement** records (every ingredient needed across all recipes)

After this script runs, the Prep Tasks and Ingredient Requirements tables are populated with everything needed for the week's ordering and prep work.

---

## When and Why It Runs

- **When:** Saturday night shift, after the stocktake has been finalised. The manager clicks "Generate Prep Run" in the Airtable Interface.
- **Why:** This is the core calculation that turns raw stock counts into actionable tasks. Without it, there are no ordering lists or prep sheets.

**Sequence:** FinaliseCount --> **GeneratePrepRun** --> GeneratePrepSheet --> GoogleDocsPrepSystem

---

## The Shortfall Calculation (How It Decides What to Prep)

### Basic Formula

```
Shortfall = Par Level - Stock Count
```

If Shortfall is greater than 0, the item needs to be prepped or ordered.

### Dynamic Reorder Point (v3.0)

Not all items with a shortfall actually need prep. The system uses a **reorder point** to decide:

```
Reorder Point = (Weekly Volume (ml) x 1.05) / 1.10
```

Where:
- **Weekly Volume (ml)** is the expected weekly sales volume for an item (set in the Items table)
- **1.05** adds a 5% wastage buffer (some product is always lost)
- **1.10** divides by 1.10 to create a 10% safety margin

**The rule:** Only trigger prep if `Stock Count < Reorder Point`.

**Example:** An item has Par = 5000ml, Weekly Volume = 3000ml, Stock Count = 3200ml
- Reorder Point = (3000 x 1.05) / 1.10 = 2863.6ml
- Stock Count (3200) > Reorder Point (2863.6)
- Result: SKIP -- do not prep this item this week

**Fallback:** If an item does not have a Weekly Volume (ml) value, the reorder point defaults to the Par Level, meaning any shortfall will trigger prep (the original behaviour).

### Batching Calculation

```
Batches Needed = ceil(Shortfall / Recipe Yield)
```

This tells you how many full batches of the recipe to make. The `ceil` (round up) ensures you always make enough to cover the shortfall.

### Buffer Multiplier

For Sub Recipe items, the script calculates a suggested quantity:

```
Suggested Qty = Target Qty x Buffer Multiplier
```

The Buffer Multiplier defaults to 1.0 but can be overridden per item via the "Buffer Multiplier" field in the Items table.

---

## Sub-Recipe Cascading

This is the clever part. When a Batch recipe requires a Sub Recipe as an ingredient, the system cascades demand:

1. Calculate Batch task (e.g., "Yuzu Sour" needs 2000ml shortfall)
2. Look at Recipe Lines for that recipe
3. For each Sub Recipe ingredient (e.g., "Yuzu Juice"):
   - Calculate total demand = Recipe Line Qty x (Shortfall / Yield)
   - Subtract what is already in stock
   - If still a shortfall, create a Sub Recipe task
4. If that Sub Recipe itself has Sub Recipe ingredients, cascade again

The `queue` mechanism prevents infinite loops by capping at 20,000 operations and detecting circular dependencies.

---

## CONFIG Object -- Key Settings

| Setting | Value | What It Means |
|---------|-------|---------------|
| `allowedTopLevelItemType` | `"Batch"` | Only "Batch" items are considered for top-level prep tasks |
| `subRecipeItemTypes` | `["Sub Recipe", "Sub-recipe"]` | Both spellings are treated as Sub Recipe items |
| `ingredientItemType` | `"Ingredient"` | Raw ingredients (purchased, not made in-house) |
| `reorderWastagePct` | `0.05` | 5% wastage in the reorder point formula |
| `reorderSafetyPct` | `0.10` | 10% safety buffer in the reorder point formula |
| `scaleRecipesExactly` | `true` | Use exact fractional scaling instead of rounding to full batches |
| `includeSubRecipesInRequirements` | `true` | Include Sub Recipe items in the Ingredient Requirements output |

---

## Phase-by-Phase Walkthrough

### Phase 1: Find Latest Verified Stocktake

Scans all Weekly Counts records for those with:
- `Confirmed = true`
- `Count Source = "Stocktake (Verified)"`

Picks the most recent Count Date. This is the stocktake the entire run is based on.

### Phase 2: Build Stock Snapshot

Creates a map of `itemId -> stock count` using all confirmed/verified records from the same stocktake minute window.

### Phase 3: Load Par Levels

Reads the Par Levels table to get the target stock level for each item.

### Phase 4: Load Items Data

Reads the Items table to get:
- Item Type (Batch, Sub Recipe, Ingredient, etc.)
- Active status
- Supplier links
- Buffer Multiplier
- Weekly Volume (ml) for reorder point calculation

### Phase 5: Load Recipes

Builds a map of which recipe produces which item, and what the yield is.

### Phase 6: Load Recipe Lines + Validate

Reads all Recipe Lines (ingredient lists for each recipe). Checks for broken links -- if a Recipe Line references an item that no longer exists, the script throws an error.

### Phase 7: Find or Create Prep Run

- Checks if a Prep Run already exists for this stocktake (by matching a `STOCKTAKE_MINUTE_ISO` key in the Notes field)
- If found: rebuilds (deletes old tasks/requirements and regenerates them)
- If not found: creates a new Prep Run record

### Phase 8: Delete Existing Children (rebuild mode)

If rebuilding an existing run, deletes all old Prep Tasks and Ingredient Requirements linked to that run.

### Phase 9: Generate Top-Level Tasks

For each active Batch item:
1. Get par level and current stock
2. Calculate reorder point (if Weekly Volume set)
3. If stock >= reorder point, SKIP (logged as "above reorder point")
4. If stock < reorder point, calculate shortfall (par - stock)
5. Look up the recipe and its yield
6. Calculate batches needed
7. Schedule the output and push to the cascading queue

### Phase 9 (continued): Cascade Sub-Recipes

Processes the queue:
1. For each scheduled output, look up recipe lines
2. For each Sub Recipe component:
   - Add its demand to a running total
   - Subtract on-hand stock
   - If demand > stock + already-scheduled output, create/update a task
   - Push the additional output to the queue for further cascading

### Phase 10: Create Task Records

Writes all generated tasks to the Prep Tasks table, including:
- Linked to the Prep Run
- Item to produce
- Recipe to use
- Target Qty
- Batches Needed
- Suggested Qty (for Sub Recipe items, using Buffer Multiplier)

### Phase 11: Generate Ingredient Requirements

For each task with a recipe:
1. Scale recipe lines by (Target Qty / Yield)
2. Aggregate across all tasks that use the same recipe
3. Create one Ingredient Requirement per unique recipe + item combination
4. Include static snapshot fields (Supplier Name, Product Category, Ordering Staff) so ordering docs can work even if supplier assignments change later

### Phases 12-16: User Capture, Summary, Request Status, Audit Log

Final cleanup and logging.

---

## Automation Inputs

| Input | Type | Default | What It Does |
|-------|------|---------|--------------|
| `requestId` | string | null | Record ID from Prep Run Requests table (for tracking automation execution) |
| `prepWeek` | date | null | Override the prep week date |
| `dryRun` | boolean | `false` | If `true`, calculates everything but does not write to the database |
| `allowDuplicates` | boolean | `false` | If `true`, creates a new Prep Run even if one exists for this stocktake |

---

## What Could Go Wrong

### "No VERIFIED stocktake found"
- **Cause:** FinaliseCount has not been run, or it was run in dry-run mode
- **Fix:** Run FinaliseCount first

### "Verified stocktake has blanks"
- **Cause:** Some items have Confirmed = true but blank Stock Count values
- **Fix:** Go back and fill in the missing values, then re-run FinaliseCount

### "Broken Recipe Lines detected"
- **Cause:** A Recipe Line points to an item that has been deleted from the Items table
- **Fix:** Open the Recipe Lines table, find the broken links (the error message lists them), and either re-link to the correct item or delete the orphaned Recipe Line

### "Exceeded maxQueueOps (20000)"
- **Cause:** Circular recipe dependency -- Recipe A uses Sub Recipe B, which uses Sub Recipe A
- **Fix:** Check your recipes for circular references and break the loop

### Tasks created but quantities seem wrong
- **Check:** Par Levels, Weekly Volume values, and Recipe Yield values. The most common cause of unexpected quantities is an incorrect Yield Qty on a recipe.

### Items skipped unexpectedly
- **Check the Audit Log details:** Items skipped because their stock was above the reorder point are listed. If an item should have been prepped, either lower its Weekly Volume or increase its Par Level.

---

## How to Check If It Worked

1. **Check the Audit Log:** Look for "GENERATE PREP RUN" with Status = "SUCCESS"
2. **Check Prep Tasks table:** Should contain one record per item that needs prepping
3. **Check Ingredient Requirements table:** Should contain one record per ingredient needed
4. **Check the Prep Runs table:** A new (or updated) record should exist with the current date
5. **Review the Audit Log details:** Shows how many tasks were created, how many items were skipped, and the stocktake date used

---

## How to Edit This Script in Airtable

1. Open the Airtable base: `https://airtable.com/appNsFRhuU47e9qlR`
2. Go to the **Automations** tab
3. Find the automation connected to the "Generate Prep Run" button
4. Click the "Run script" action step

**Warning:** This is the most complex script in the system. Changes to the shortfall calculation, reorder point formula, or cascading logic can have significant downstream effects. Test with `dryRun: true` first.

**Key values to check if results seem off:**
- `CONFIG.reorderWastagePct` (5%) and `CONFIG.reorderSafetyPct` (10%) control the reorder point formula
- `CONFIG.scaleRecipesExactly` -- if changed to `false`, recipes round up to full batches instead of fractional scaling
- `CONFIG.allowedTopLevelItemType` must be `"Batch"` for top-level tasks
- `CONFIG.subRecipeItemTypes` must include both `"Sub Recipe"` and `"Sub-recipe"` (Airtable may have either spelling)
