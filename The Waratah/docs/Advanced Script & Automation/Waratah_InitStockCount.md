# Waratah_InitStockCount.gs -- InitStockCount Explainer

**Script:** `Waratah_InitStockCount.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Manual button or scheduled automation (Monday AM)

---

## What It Does

This script initialises a new stock count session. It:

1. Creates a new **Count Session** record in Airtable
2. Creates one **Stock Count** placeholder record for every active item with `Core Order = true` (~59 items)
3. Pre-fills the "Previous Count" field on each placeholder with the quantity from the last completed session (so you can see what you counted last time)
4. Deletes ALL Stock Count and Stock Order records from previous sessions (sessions themselves are kept for history)
5. Sets the new session status to "In Progress" so counting can begin

After this runs, Evan opens the Airtable Stock Count interface and sees ~59 items ready to be counted, each with 5 tally columns (Public Bar, Terrace Bar, Banquettes, Cool Rooms, Back Storage).

---

## When It Runs

- **Normal cycle:** Monday AM, before the bar stock count begins
- **Manual re-run:** Can be triggered manually at any time via the Airtable button
- **Safe to re-run:** Each run creates a fresh session and cleans up old data

---

## Inputs (Automation Inputs)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `dryRun` | boolean | `false` | When `true`, logs what would happen without creating/deleting records |
| `countedBy` | string | `"Evan"` | Name to set in the "Counted By" field on the new session |

---

## CONFIG Object Explained

The CONFIG at the top of the script defines all table and field names. If a field name changes in Airtable, you update it here.

Key settings:

| Config Key | Value | Notes |
|------------|-------|-------|
| `itemsTableName` | `"Items"` | Table containing all bar stock items |
| `countSessionsTableName` | `"Count Sessions"` | Table tracking each count session |
| `stockCountsTableName` | `"Stock Counts"` | Table with one record per item per session |
| `stockOrdersTableName` | `"Stock Orders"` | Table with calculated order quantities |
| `itemCoreOrderField` | `"Core Order"` | Checkbox field -- only items with this checked get counted |
| `countQuantityField` | `"Total On Hand"` | Formula field that sums the 5 area tally fields |
| `countPreviousField` | `"Previous Count"` | Number field pre-filled with last session's count |
| `batchSize` | `50` | Airtable API limit -- records are created/deleted in batches of 50 |

---

## Phase-by-Phase Walkthrough

### Phase 1: Load Tables
Loads all required Airtable tables (Items, Count Sessions, Stock Counts, Audit Log). If the Audit Log table does not exist, the script stores a `null` reference and skips audit logging later.

### Phase 2: Load Existing Sessions
Fetches all existing Count Sessions with their dates, statuses, and linked Stock Counts. This data is used in Phase 4 to find previous counts for pre-filling.

### Phase 3: Fetch Core Order Items
Queries the Items table and filters for items where:
- `Core Order` = `true`
- `Active` is not `false`

Currently ~59 items match. If zero items match, the script stops with a "blocked" status.

### Phase 4: Fetch Previous Counts for Pre-fill
Finds the most recent session with status "Orders Generated", "Completed", or "Validated" (sorted by date descending). For that session, it reads all linked Stock Count records and builds a map of `itemId --> quantity`. This map is used in Phase 6 to pre-fill the "Previous Count" field on new placeholders.

If no previous completed session exists (first-ever run), this phase is skipped gracefully.

### Phase 5: Create Count Session
Creates a new Count Session record with:
- `Session Date` = today's date
- `Status` = "Not Started"
- `Counted By` = value from input (default "Evan")

In dry run mode, this is logged but not created.

### Phase 6: Create Stock Count Placeholders
For each Core Order item, creates a Stock Count record with:
- `Item` = linked to the item record
- `Count Session` = linked to the session just created
- `Previous Count` = quantity from the previous session (if available)

Records are created in batches of 50 (Airtable API limit). After creation, the session status is updated to "In Progress".

### Phase 7: Wipe Previous Stock Counts and Stock Orders
This is the cleanup phase. It:

1. Builds a set of the placeholder record IDs just created in Phase 6 (to protect them from deletion)
2. Queries ALL Stock Count records and deletes any that are NOT in the protected set
3. Queries ALL Stock Order records and deletes all of them

**Important:** Sessions themselves are NOT deleted -- only their child Stock Count and Stock Order records. This means you can still see historical session records for reference, but their detailed data is cleared.

**Why this matters:** Without cleanup, the Stock Counts table would grow indefinitely. Old data from previous sessions would also interfere with queries in other scripts.

### Phase 8: Summary
Logs a summary with counts of items, placeholders created, previous counts loaded, and records cleaned up.

### Phase 9: Audit Log
Writes a SUCCESS entry to the Audit Log table with execution details. Skipped in dry run mode or if the Audit Log table does not exist.

---

## Dry Run Support

Set `dryRun = true` in the automation input to run the script without making any changes. The script will:
- Log everything it would do
- Show how many records it would create/delete
- NOT create any Count Session, Stock Count, or Stock Order records
- NOT delete any existing records

Use dry run to verify the script is working correctly before a live run.

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "No items with Core Order = true found" | No items have the Core Order checkbox ticked | Open the Items table, find the items that should be counted, tick "Core Order" |
| Script fails with "Cannot create record" | A field name in CONFIG does not match the actual Airtable field name | Compare CONFIG field names against the actual table schema |
| "Audit Log table not found" error | The Audit Log table was deleted or renamed | Create a table called "Audit Log" with the required fields |
| Previous counts show as 0 | The previous session had status other than "Completed"/"Validated"/"Orders Generated" | This is expected on first run or if previous sessions failed |
| Placeholders show wrong item count | Items were added/removed from Core Order since last run | This is expected -- the script always uses the current Core Order list |

---

## How to Check If It Worked

1. Open the **Count Sessions** table in Airtable
2. You should see a new session with today's date and status "In Progress"
3. Open the **Stock Counts** table -- you should see ~59 placeholder records linked to the new session
4. The "Previous Count" column should show last session's values (if any)
5. The **Stock Orders** table should be empty (all previous orders deleted)
6. Check the **Audit Log** table for a SUCCESS entry from "WARATAH - INIT STOCK COUNT"

---

## How to Edit This Script in Airtable

1. Open the Airtable base
2. Go to **Automations** (top bar)
3. Find the automation that runs this script (look for "Init Stock Count" in the name)
4. Click the script action to open the code editor
5. Make your changes
6. Click "Save" (or the run button to test)

Remember: this script does NOT go to GAS. It stays in Airtable only.
