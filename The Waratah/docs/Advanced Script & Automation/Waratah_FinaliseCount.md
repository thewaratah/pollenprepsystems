# Waratah_FinaliseCount.gs -- FinaliseCount Explainer

**Script:** `Waratah_FinaliseCount.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Scheduled automation -- Sunday 11pm

---

## What It Does

This script validates and finalises the Weekly Counts prep stocktake. It:

1. Finds all unconfirmed Weekly Count records
2. Checks that every record has a `Stock Count` value (blank is not allowed -- 0 is fine)
3. Optionally validates recipe integrity (checks for broken links, missing recipes, zero yields)
4. Sets `Confirmed = true` on all records
5. Normalises the `Count Date` to a consistent timestamp
6. Sets `Count Source = "Stocktake (Verified)"`
7. Writes an audit log entry

This script is the gate between "data entry" and "prep run generation." GeneratePrepRun only works with confirmed, verified counts.

---

## When It Runs

- **Normal cycle:** Sunday 11pm (automated), after staff have finished entering their prep counts during the week
- **Can be triggered manually** via the Airtable automation

---

## Inputs (Automation Inputs)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `dryRun` | boolean | `false` | Logs what would happen without updating records |
| `skipRecipeValidation` | boolean | `false` | When `true`, skips the recipe integrity check |

---

## CONFIG Object Explained

Key settings:

| Config Key | Value | Notes |
|------------|-------|-------|
| `countsTableName` | `"Weekly Counts"` | The table being finalised |
| `recipesTableName` | `"Recipes"` | Used for recipe integrity validation |
| `recipeLinesTableName` | `"Recipe Lines"` | Used for recipe integrity validation |
| `verifiedSourceName` | `"Stocktake (Verified)"` | Value set in Count Source after finalisation |
| `batchItemType` | `"Batch"` | Item type that should have a recipe |
| `subRecipeItemTypes` | `["Sub Recipe", "Sub-recipe"]` | Item types that should have a recipe |
| `maxBlankItemsToShow` | `25` | Maximum blank items to list in error output |

**Important note on `Item Name`:** The CONFIG has both `itemNameField` (for the Items table) and `recipeProducesItemField` (for the Recipes table) both set to `"Item Name"`. In the Items table, `Item Name` is a plain text field (the display name). In the Recipes table, `Item Name` is a linked-record field pointing to the Items table. They are different field types with the same name -- this is an Airtable design choice, not a bug.

---

## Phase-by-Phase Walkthrough

### Prologue: Recipe Integrity Validation (Optional)
If `skipRecipeValidation` is `false` (default), the script runs a comprehensive recipe check before finalising counts. This is a WARNING-only check -- it does not block finalisation, but it logs issues that should be fixed before GeneratePrepRun runs.

Checks performed:
- **Missing recipes:** Batch and Sub Recipe items that have no recipe assigned
- **Zero yield recipes:** Recipes with `Yield Qty` = 0 (would cause divide-by-zero in prep run)
- **Missing yield values:** Recipes with no `Yield Qty` at all
- **Broken recipe links:** Recipe Lines that reference items no longer in the Items table

Issues are logged to the console and included in the audit log, but finalisation proceeds regardless.

### Phase 1: Fetch Weekly Counts
Loads all records from the Weekly Counts table with their Stock Count, Count Date, Count Source, Confirmed, and Item link fields.

### Phase 2: Filter for Unconfirmed Records
Filters to only unconfirmed records (`Confirmed` is not `true`). If a Count Source field exists, it further filters to only "Stocktake (Verified)" unconfirmed records (in case some verified records exist alongside placeholder ones).

If all records are already confirmed, the script exits early with "Nothing to Do."

### Phase 3: Validate for Blanks
Checks every target record for blank `Stock Count` values. If any are found, the script **throws an error** with a list of items that have blank counts. This is a hard block -- you cannot finalise until all items have a count value.

0 is acceptable. Blank/null is not.

### Phase 4: Prepare Finalization
Sets up the batch update with:
- `Confirmed` = `true`
- `Count Date` = current timestamp (normalised to minute precision for consistency)
- `Count Source` = `"Stocktake (Verified)"`

### Phase 5: Execute Updates
Applies the updates in batches of 50.

### Phase 6-9: User Capture, Summary, Audit Log
Captures the user who triggered the automation, logs the summary, and writes to the Audit Log. Status is either SUCCESS (no recipe issues) or WARNING (recipe issues found but finalisation completed).

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "Cannot finalize: X items have blank Stock Count" | Bar staff did not enter counts for all items | Open Weekly Counts table and fill in the missing Stock Count values (0 is fine if the item is truly at zero) |
| Recipe warnings in audit log | Batch/Sub Recipe items without recipes, or recipes with zero yield | Open the Recipes table and fix the issues. These must be fixed before GeneratePrepRun or it may fail |
| "All records already confirmed" | Script already ran or counts were manually confirmed | No action needed -- this is informational |
| Script takes too long | Very large number of Weekly Count records | Not expected with normal item counts |

---

## How to Check If It Worked

1. Open the **Weekly Counts** table
2. All records should now have `Confirmed = true`
3. `Count Source` should show `"Stocktake (Verified)"` on all records
4. `Count Date` should show a consistent timestamp (all the same minute)
5. Check the **Audit Log** for a "WARATAH - FINALISE COUNT" entry
6. If there are recipe warnings, they will appear in the audit log Details field

---

## What Happens Next

After this script runs (Sunday 11pm), `Waratah_GeneratePrepRun.gs` runs at Sunday 11:15pm. It uses the confirmed counts to calculate prep shortfalls and generate prep tasks.
