# Waratah_ValidateStockCount.gs -- ValidateStockCount Explainer

**Script:** `Waratah_ValidateStockCount.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Fires automatically when a Count Session's Status changes to "Completed"

---

## What It Does

This script validates a completed stock count session. After Evan finishes counting all ~59 items and marks the session as "Completed" (via the CompleteStockCount button), this script automatically:

1. Finds the target session (auto-detects the latest "Completed" session, or uses a specific session ID)
2. Checks every Stock Count record for problems:
   - **Not counted:** Items where `Total On Hand` is null (no tallies entered at all) -- these BLOCK validation
   - **Negative quantities:** Items with negative counts -- these BLOCK validation
   - **Outliers:** Items where the count is suspiciously different from the previous count (over 3x or under 0.2x)
3. Flags problematic records by setting `Needs Review = true`
4. Sets the session status to either:
   - **"Validated"** if all counts look good (no blockers, maybe some outliers)
   - **"Needs Review"** if any items are not counted, have negative quantities, or have outliers

---

## When It Runs

- **Normal cycle:** Automatically triggered when CompleteStockCount sets a session to "Completed"
- **Can also be triggered manually** by running the automation or providing a `sessionId` input

---

## Inputs (Automation Inputs)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `sessionId` | string | auto-detect | Specific session ID to validate. If omitted, finds the latest "Completed" session |
| `dryRun` | boolean | `false` | When `true`, logs what would happen without updating records |

---

## CONFIG Object Explained

Key settings:

| Config Key | Value | Notes |
|------------|-------|-------|
| `outlierHighMultiplier` | `3.0` | Flag if count is more than 3x the previous count |
| `outlierLowMultiplier` | `0.2` | Flag if count is less than 20% of previous count (80%+ drop) |
| `maxIssuesToShow` | `30` | Maximum issues to display in console log |
| `countQuantityField` | `"Total On Hand"` | Formula field (sum of 5 area tallies) |
| `countPreviousField` | `"Previous Count"` | Number field with previous session's count |
| `countNeedsReviewField` | `"Needs Review"` | Checkbox field for flagging problematic records |

---

## Phase-by-Phase Walkthrough

### Phase 1: Load Tables
Loads Items, Count Sessions, Stock Counts, and Audit Log tables.

### Phase 2: Find Target Session
If `sessionId` is provided, looks up that specific session. Otherwise, finds all sessions with status "Completed" and picks the most recent by date.

Throws an error if no "Completed" session exists.

### Phase 3: Fetch Linked Stock Counts
Gets all Stock Count records linked to the target session. Builds an item name lookup map from the Items table for readable log output.

### Phase 4: Validate Counts
Iterates through every Stock Count record and checks:

- **`Total On Hand` is null:** The formula returns BLANK() when all 5 tally fields are empty. This means the item was not counted at all. These are added to the `notCounted` list.
- **`Total On Hand` is negative:** Should never happen but is checked as a safety measure.
- **Outlier detection:** Only runs if a previous count exists and is greater than 0:
  - Count is 0 but previous was non-zero: flagged as "complete depletion"
  - Count is more than 3x previous: flagged (ratio shown, e.g., "5.2x previous")
  - Count is less than 20% of previous: flagged as "large drop"

### Phase 5: Flag Records for Review
Sets `Needs Review = true` on all problematic records. Also clears the flag on records that were previously flagged but are now fine (handles re-validation after corrections).

### Phase 6: Determine Result Status
- If any items are not counted: **"Needs Review"**
- If any items have negative quantities: **"Needs Review"**
- If any items have outliers: **"Needs Review"**
- If everything is clean: **"Validated"**

Note: Outliers cause "Needs Review" even though they might be legitimate. The idea is to force a human to check unusual counts before ordering. You can manually change the session status to "Validated" in Airtable if the outliers are expected.

### Phase 7: Update Session Status
Updates the session's Status field to the determined result. Also writes validation notes to the session's Notes field (timestamp, counts summary, outlier details).

### Phase 8: Summary
Logs a summary of validation results.

### Phase 9: Audit Log
Writes to the Audit Log with status WARNING (if issues found) or SUCCESS.

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "No session with status 'Completed' found" | CompleteStockCount has not run, or session status was changed manually | Run CompleteStockCount first, or manually set the session status to "Completed" |
| "Session has no linked Stock Count records" | InitStockCount was not run for this session | Run InitStockCount to create placeholder records |
| Many "not counted" items | Evan did not finish entering tallies for all items | Go back to the Stock Count interface and fill in the missing tallies |
| Many outliers flagged | Stock levels genuinely changed a lot, OR previous count was wrong | Review each flagged item. If the counts are correct, manually set session status to "Validated" |
| Script times out | Too many records to process | This should not happen with ~59 items. If it does, check for data issues |

---

## How to Check If It Worked

1. Open the **Count Sessions** table
2. The target session should now show status "Validated" or "Needs Review"
3. The **Notes** field should contain validation details (timestamp, counts, outliers)
4. Open the **Stock Counts** table -- items with issues should have `Needs Review` checked
5. Check the **Audit Log** for a "WARATAH - VALIDATE STOCK COUNT" entry

---

## What Happens Next

- If status is **"Validated"**: `Waratah_GenerateStockOrders.gs` can run (either automatically or manually)
- If status is **"Needs Review"**: Fix the flagged items, then either:
  - Re-run CompleteStockCount (which will re-trigger validation), or
  - Manually change the session status to "Validated" if you are satisfied the counts are correct
