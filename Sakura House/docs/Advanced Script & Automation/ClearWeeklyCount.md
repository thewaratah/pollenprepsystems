# ClearWeeklyCount.gs -- Script Explainer

**Version:** 2.0
**Runs in:** Airtable Automation
**Trigger:** Scheduled -- Saturday 8:00 AM Sydney time (or Interface button)
**Last Updated:** 2026-03-22

---

## What It Does

ClearWeeklyCount prepares the Weekly Counts table for a new stocktake. It does three things:

1. **Deletes** all existing records in the Weekly Counts table (or preserves verified ones if configured)
2. **Queries** the Items table to find all active items that need counting
3. **Creates placeholder records** -- one per active item, with Stock Count set to 0 and Confirmed set to false

After this script runs, staff will see a clean list of items in the Airtable Interface, each showing 0. Their job during the Saturday shift is to physically count stock and update each item's Stock Count value.

---

## When and Why It Runs

- **When:** Every Saturday at 8:00 AM, automatically (or manually via Interface button)
- **Why:** The previous week's stock counts are no longer relevant. The system needs fresh placeholder records so staff can enter new counts during the Saturday shift.

---

## CONFIG Object Explained

| Setting | Value | What It Means |
|---------|-------|---------------|
| `itemsTableName` | `"Items"` | Master list of all items |
| `countsTableName` | `"Weekly Counts"` | Where stock count records live |
| `auditLogTableName` | `"Audit Log"` | Execution logging |
| `allowedItemTypes` | `["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]` | Only these item types get placeholder records |
| `placeholderSourceName` | `"Generated / Placeholder"` | Label applied to auto-created records |
| `verifiedSourceName` | `"Stocktake (Verified)"` | Source label for actual stocktake data |
| `batchSize` | `50` | Records are created/deleted in groups of 50 |

**Note:** "Ingredient" type items do NOT get placeholder records. Only items that need to be physically counted (Batch, Sub Recipe, Garnish, Other) are included.

---

## Automation Inputs

| Input | Type | Default | What It Does |
|-------|------|---------|--------------|
| `includeInactive` | boolean | `false` | If `true`, creates placeholders for inactive items too |
| `dryRun` | boolean | `false` | If `true`, reports what would happen without making changes |
| `preserveVerifiedStocktakes` | boolean | `false` | If `true`, keeps existing records with "Stocktake (Verified)" + Confirmed = true |

Under normal weekly operation, all three default to `false` -- the script deletes everything and creates fresh placeholders for active items only.

---

## Phase-by-Phase Walkthrough

### Phase 1: Delete Existing Counts

1. Queries all records in the Weekly Counts table
2. If `preserveVerifiedStocktakes` is true, only deletes records that are NOT confirmed and verified. Otherwise deletes all records.
3. Deletes in batches of 50

### Phase 2: Query Items Table

1. Reads all records from the Items table
2. Filters to only active items (unless `includeInactive` is true)
3. Filters to only allowed item types (Batch, Sub Recipe, Sub-recipe, Garnish, Other)
4. Counts how many of each type were matched

### Phase 3: Create Placeholders

For each matched item, creates a new Weekly Counts record with:
- **Item:** linked to the item record
- **Stock Count:** 0
- **Count Date:** current timestamp
- **Count Source:** "Stocktake (Verified)"
- **Confirmed:** false

Records are created in batches of 50.

### Phase 4: Capture User

Attempts to identify who triggered the automation by checking the "Last Modified By" field on recently created records.

### Phase 5-6: Summary + Audit Log

Logs the execution results including:
- How many records were deleted
- How many were preserved (if applicable)
- How many placeholders were created
- Item type breakdown (e.g., "Batch (45), Sub Recipe (12), Garnish (8)")

### Output Variables

The script sets output variables that can be used by subsequent automation steps:
- `deletedCount`, `preservedVerifiedCount`, `createdCount`, `matchedItemCount`, `status`, `executionTime`

---

## What Could Go Wrong

### "Items table not found" or "Weekly Counts table not found"
- **Cause:** Table names in CONFIG do not match the actual table names in Airtable
- **Fix:** Check table names are exactly "Items" and "Weekly Counts"

### Placeholders created but count seems wrong
- **Cause:** Items may be set to Inactive, or their Item Type is not in the allowed list
- **Check:** Open the Items table and filter for Active = true. Count how many have Item Type = Batch, Sub Recipe, etc. The number should match the script output.

### Script runs twice accidentally
- **Impact:** You will get duplicate placeholder records (two "0" entries per item)
- **Fix:** Run the script again -- it deletes all existing records first, so it is safe to re-run

### "Audit Log table not found" error
- **Cause:** Unlike ClearPrepData (which warns but continues), ClearWeeklyCount v2.0 will throw an error if the Audit Log table is missing
- **Fix:** Create the Audit Log table with the required fields

---

## How to Check If It Worked

1. **Check the Audit Log:** Look for "CLEAR WEEKLY COUNT" with Status = "SUCCESS"
2. **Check Weekly Counts table:** Should contain one record per active item, all with Stock Count = 0 and Confirmed = false
3. **Check the Airtable Interface:** The stocktake view should show all items ready to be counted

---

## How to Edit This Script in Airtable

1. Open the Airtable base: `https://airtable.com/appNsFRhuU47e9qlR`
2. Go to the **Automations** tab
3. Find the automation (likely named "Saturday AM: Clear Weekly Count" or similar)
4. Click the "Run script" action step to open the code editor
5. Make changes and click "Test" to verify
6. The automation's schedule trigger handles the weekly timing -- no need to change that unless you want to adjust the time

**Critical reminder:** If you rename the "Items" or "Weekly Counts" tables in Airtable, you MUST update the CONFIG values in this script to match.
