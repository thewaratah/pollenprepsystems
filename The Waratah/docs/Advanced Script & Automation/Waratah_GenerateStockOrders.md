# Waratah_GenerateStockOrders.gs -- GenerateStockOrders Explainer

**Script:** `Waratah_GenerateStockOrders.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Runs after ValidateStockCount sets session status to "Validated" (or manually triggered)

---

## What It Does

This script calculates how much of each bar stock item needs to be ordered, combining both service shortfall (bar stock below par) and prep usage (ingredients needed for this week's prep). It:

1. Finds the latest validated Count Session
2. Aggregates stock counts by item (Total On Hand)
3. Looks up par levels for each item
4. Looks up prep usage from the latest Prep Run's Ingredient Requirements
5. Calculates combined order quantities
6. Deletes any existing Stock Orders for this session (idempotent re-run)
7. Creates new Stock Order records
8. Sets session status to "Orders Generated"
9. Auto-sets `Ordering Export State = REQUESTED` to trigger GAS doc generation

---

## The Ordering Formula

For each counted item:

```
Service Shortfall = MAX(0, Par Qty - Total On Hand)
Prep Usage       = SUM(Ingredient Requirements for this item from latest Prep Run)
Combined Order   = Service Shortfall + Prep Usage
```

**Service Shortfall** covers bar stock replenishment (how much you need to get back to par level).

**Prep Usage** covers ingredients needed for prep (calculated by GeneratePrepRun and stored in Ingredient Requirements). For items with an Order Volume > 1 (e.g., a bottle holds 700ml but the recipe uses ml), the prep usage is converted from recipe units (ml) to order units (bottles) by dividing by Order Volume.

**Combined Order** is the total amount to order, covering both bar service and prep needs.

---

## When It Runs

- **Normal cycle:** Automatically triggered after ValidateStockCount sets status to "Validated"
- **Re-runs:** Safe to re-run -- Phase 8 deletes existing orders before creating new ones
- **Accepts sessions with status "Validated" or "Orders Generated"** (for re-generation)

---

## Inputs (Automation Inputs)

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `sessionId` | string | auto-detect | Specific session to process. If omitted, finds the latest "Validated" or "Orders Generated" session |
| `dryRun` | boolean | `false` | Logs what would happen without creating/deleting records |

---

## Phase-by-Phase Walkthrough

### Phase 1: Load Tables
Loads Items, Par Levels, Count Sessions, Stock Counts, Stock Orders, Prep Runs, Ingredient Requirements, Supplier, and Audit Log tables.

### Phase 2: Find Validated Session
Finds the latest Count Session with status "Validated" or "Orders Generated". If the session already has status "Orders Generated", the script notes it will be regenerated (old orders deleted in Phase 8).

### Phase 3: Aggregate Stock Counts by Item
Gets all Stock Count records linked to the target session. For each item, sums the Total On Hand value (though with the current one-record-per-item model, this is typically just one record per item).

### Phase 4: Fetch Par Levels
Reads the Par Levels table for active par levels. If multiple par levels exist for the same item, uses the highest.

### Phase 5: Fetch Prep Usage from Latest Prep Run
Finds the most recent Prep Run within the last 7 days. Reads its Ingredient Requirements and sums the `Total Qty Needed` for each item. If no recent Prep Run exists, prep usage is 0 for all items.

### Phase 6: Load Item Metadata
Fetches item names, types, suppliers, order volumes, and units. Also builds a supplier metadata lookup (supplier name, product category, ordering staff).

### Phase 7: Calculate Orders
For each counted item:
1. Looks up par level, on-hand quantity, and prep usage
2. Converts prep usage from recipe units to order units (divides by Order Volume if > 1)
3. Calculates service shortfall and combined order quantity
4. Resolves supplier metadata (name, product category, ordering staff)
5. Creates a Stock Order record payload with status "Pending" (if combined > 0) or "No Order Needed" (if combined = 0)

### Phase 8: Delete Existing Orders (Idempotent Re-run)
Checks if the session already has linked Stock Order records. If so, deletes them all. This makes the script safe to re-run -- you get fresh calculations every time.

### Phase 9: Create Stock Order Records
Creates the new Stock Order records in batches of 50.

### Phase 10: Update Session Status + Trigger Export
Updates the Count Session with:
- `Status = "Orders Generated"`
- `Ordering Export State = "REQUESTED"` (triggers GAS polling to generate the ordering doc)

This is the key automation step -- it eliminates the need to manually press the "Export Ordering Doc" button. The ordering doc is generated automatically within 1-2 minutes.

### Phases 11-12: Summary and Audit Log
Standard summary and audit logging.

---

## Stock Orders Table Fields

Each Stock Order record contains:

| Field | Description |
|-------|-------------|
| `Item` | Linked to the Items table |
| `Count Session` | Linked to the Count Session |
| `Total On Hand` | How much is currently in stock |
| `Prep Usage` | How much is needed for this week's prep (in order units) |
| `Prep Qty` | The par level for this item |
| `Service Shortfall` | MAX(0, Par - On Hand) |
| `Combined Order Qty` | Service Shortfall + Prep Usage |
| `Supplier Name (Static)` | Denormalized supplier name |
| `Product Category (Static)` | Denormalized product category |
| `Ordering Staff (Static)` | Denormalized ordering staff assignment |
| `Status` | "Pending" or "No Order Needed" |

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "No validated session found" | ValidateStockCount has not run, or session is in "Needs Review" | Run ValidateStockCount, or manually set session status to "Validated" |
| "Session has no linked Stock Count records" | InitStockCount did not create count records | Run InitStockCount first |
| All orders show 0 | All items are at or above par level and no prep usage exists | This is normal if stock is full and there is no prep this week |
| Prep usage is 0 for all items | No Prep Run exists within the last 7 days | Check that GeneratePrepRun ran recently. The 7-day lookback window is set by `prepRunLookbackDays` in CONFIG |
| Ordering doc not generated | GAS polling is not running | Check GAS triggers in the GAS editor |

---

## How to Check If It Worked

1. Open the **Stock Orders** table -- you should see one record per counted item, linked to the target session
2. Records with `Combined Order Qty > 0` should have `Status = "Pending"`
3. Records with `Combined Order Qty = 0` should have `Status = "No Order Needed"`
4. The **Count Sessions** table should show `Status = "Orders Generated"` and `Ordering Export State = "REQUESTED"`
5. Within 1-2 minutes, `Ordering Export State` should change to "COMPLETED" (GAS generated the doc)
6. Check the **Audit Log** for "WARATAH - GENERATE STOCK ORDERS"

---

## What Happens Next

After this script sets `Ordering Export State = REQUESTED`, GAS automatically:
1. Detects the request during its next polling cycle (every 1-2 minutes)
2. Generates the Combined Ordering Run Sheet (grouped by supplier)
3. Sends a Slack notification with the doc link
4. Sets `Ordering Export State = COMPLETED`
