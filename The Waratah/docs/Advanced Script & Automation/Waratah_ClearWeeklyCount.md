# Waratah_ClearWeeklyCount.gs -- ClearWeeklyCount Explainer

**Script:** `Waratah_ClearWeeklyCount.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Scheduled automation -- Monday 3pm (resets for next week's stocktake)

---

## What It Does

This script resets the **Weekly Counts** table to prepare for a new prep stocktake cycle. It:

1. Deletes all existing Weekly Count records (or preserves verified ones, depending on mode)
2. Queries the Items table for all active items with allowed types (Batch, Sub Recipe, Sub-recipe, Garnish, Other)
3. Creates one placeholder record per matched item with `Stock Count = 0` and `Count Source = "Generated / Placeholder"`
4. Writes an audit log entry

The Weekly Counts table is separate from the Stock Counts table used for bar stock ordering. Weekly Counts tracks prep items (batches, sub-recipes) for the prep cycle. Stock Counts tracks Core Order items for bar stock ordering.

---

## When It Runs

- **Normal cycle:** Monday 3pm (automated), after the prep run has been generated
- **Can be triggered manually** for re-runs or corrections

---

## Inputs (Automation Inputs)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `dryRun` | boolean | `false` | Logs what would happen without creating/deleting records |
| `includeInactive` | boolean | `false` | When `true`, also creates placeholders for inactive items |
| `preserveVerifiedStocktakes` | boolean | `false` | When `true`, keeps records where `Confirmed = true` and `Count Source = "Stocktake (Verified)"` |
| `addMissingOnly` | boolean | `false` | When `true`, skips deletion entirely and only adds placeholders for items not already in the table |

---

## The addMissingOnly Mode

This is an important safety feature. When `addMissingOnly = true`:

- **No records are deleted** -- all existing Weekly Count records are preserved
- The script checks which items already have a Weekly Count record
- It only creates new placeholders for items that are missing from the table
- Use this for **mid-week re-runs** when new items have been added to Airtable and you want to add them to the current count without wiping existing data

Example scenario: You added 3 new Sub Recipe items on Wednesday. Instead of resetting the whole table (which would wipe counts already entered), you run with `addMissingOnly = true` to add just those 3 new items.

---

## CONFIG Object Explained

Key settings:

| Config Key | Value | Notes |
|------------|-------|-------|
| `countsTableName` | `"Weekly Counts"` | The table being reset |
| `allowedItemTypes` | `["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]` | Only items of these types get placeholders |
| `placeholderSourceName` | `"Generated / Placeholder"` | Value set in the Count Source field for auto-generated records |
| `verifiedSourceName` | `"Stocktake (Verified)"` | Value that identifies manually verified counts (used by preserveVerified mode) |
| `countStaffDefaultValue` | `"Blade"` | Default value for the Staff field on new placeholder records |
| `batchSize` | `50` | Records created/deleted in batches of 50 |

---

## Phase-by-Phase Walkthrough

### Phase 1: Scan Existing Counts
Queries all existing Weekly Count records. Behaviour depends on mode:

- **Normal mode (`addMissingOnly = false`, `preserveVerifiedStocktakes = false`):** All records are marked for deletion
- **Preserve verified mode:** Records with `Confirmed = true` AND `Count Source = "Stocktake (Verified)"` are kept; all others are deleted
- **Add missing only mode:** No records are deleted. Instead, builds a set of item IDs that already have records (used to skip them in Phase 3)

Deletion happens in batches of 50.

### Phase 2: Query Items for Placeholders
Fetches all items from the Items table and filters for:
- Item Type is one of: Batch, Sub Recipe, Sub-recipe, Garnish, Other
- Item is active (unless `includeInactive = true`)

Logs a breakdown by item type (e.g., "Batch: 15, Sub Recipe: 8, Garnish: 3").

### Phase 3: Create Placeholders
For each matched item, creates a Weekly Count record with:
- `Item` = linked to the item record
- `Stock Count` = 0
- `Count Date` = now
- `Count Source` = "Generated / Placeholder"
- `Confirmed` = false
- `Staff` = "Blade" (if the field exists)

In `addMissingOnly` mode, items that already have a record are skipped.

### Phase 4: Capture User Info
Attempts to detect who triggered the script by reading the "Last Modified By" field on recent records. Falls back to "(Unknown)" if the field does not exist.

### Phase 5: Summary
Logs execution time, records deleted, preserved, and created.

### Phase 6: Audit Log
Writes a SUCCESS entry to the Audit Log with full details including config used.

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| No placeholders created | No active items match the allowed item types | Check the Items table: do items have correct Item Type and Active status? |
| Wrong number of placeholders | Items were added/removed or changed type since last run | This is expected -- the script always uses the current Items list |
| Existing counts were deleted unexpectedly | Script ran without `addMissingOnly = true` | Use `addMissingOnly = true` for mid-week runs to avoid data loss |
| Script creates duplicates | `addMissingOnly` was not used and existing records were not deleted | Ensure `preserveVerifiedStocktakes` and `addMissingOnly` settings are correct |
| "Audit Log table not found" | Audit Log table missing or renamed | Create the table with required fields |

---

## How to Check If It Worked

1. Open the **Weekly Counts** table in Airtable
2. You should see one record per active Batch/Sub Recipe/Garnish/Other item
3. All records should have `Stock Count = 0` and `Count Source = "Generated / Placeholder"`
4. `Confirmed` should be `false` on all records
5. Check the **Audit Log** for a "WARATAH - CLEAR WEEKLY COUNT" entry with the correct counts

---

## What Happens Next

After this script runs, bar staff can begin entering their prep stocktake counts. When they are done, `Waratah_FinaliseCount.gs` validates and finalises the counts.
