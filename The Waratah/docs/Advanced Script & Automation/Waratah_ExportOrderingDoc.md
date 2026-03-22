# Waratah_ExportOrderingDoc.gs -- ExportOrderingDoc Explainer

**Script:** `Waratah_ExportOrderingDoc.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Button press in Count Sessions interface

---

## What It Does

This is a simple trigger script. It finds the latest Count Session with status "Orders Generated" and sets its `Ordering Export State` field to `"REQUESTED"`. GAS then picks this up during its next polling cycle and generates the Combined Ordering Run Sheet.

You typically do NOT need to use this script manually because `Waratah_GenerateStockOrders.gs` now auto-sets `Ordering Export State = REQUESTED` in its Phase 10. This script exists as a **manual re-trigger** -- use it when:

- The ordering doc needs to be regenerated (e.g., after fixing data)
- You cleared the `Ordering Export State` to COMPLETED and want a fresh doc
- The GAS export failed and you want to retry

---

## When It Runs

- **Manual only:** Triggered by pressing a button in the Count Sessions Airtable interface
- **No inputs required** -- auto-detects the latest "Orders Generated" session

---

## Guards

The script has safety guards to prevent unnecessary re-triggers:

| Current State | Behaviour |
|---------------|-----------|
| Empty / null | Sets to "REQUESTED" -- normal operation |
| "REQUESTED" | Does nothing -- already waiting for GAS to process |
| "COMPLETED" | Does nothing -- doc already generated. Clear the field first if you want to regenerate |
| "ERROR" | Sets to "REQUESTED" -- retries after a failed export |

---

## Phase-by-Phase Walkthrough

### Phase 1: Find Latest "Orders Generated" Session
Queries all Count Sessions and filters for `Status = "Orders Generated"`. If none found, throws an error. Picks the most recent by date.

Checks the current `Ordering Export State`:
- If "REQUESTED": logs "already requested" and exits
- If "COMPLETED": logs "already completed" and exits
- Otherwise: proceeds to Phase 2

### Phase 2: Mark Session for Export
Sets `Ordering Export State = "REQUESTED"` on the session record.

### Audit Log
Writes a SUCCESS entry recording the export request.

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "No Count Session with status 'Orders Generated'" | GenerateStockOrders has not run, or session status was changed | Run the full stock count workflow first |
| "Already REQUESTED" | Script was already triggered and GAS hasn't processed it yet | Wait 1-2 minutes for GAS to process. Check GAS execution logs if nothing happens |
| "Already COMPLETED" | Ordering doc was already generated | To regenerate, clear the `Ordering Export State` field in Airtable, then press the button again |
| GAS never processes the request | GAS time-trigger is not running | Open GAS editor, check Triggers for `processOrderingExportRequests` |
| "Field 'Ordering Export State' not found" | The field was renamed or deleted from Count Sessions | Add a Single Select field called "Ordering Export State" with options: REQUESTED, COMPLETED, ERROR |

---

## How to Check If It Worked

1. Open the **Count Sessions** table
2. The target session should show `Ordering Export State = "REQUESTED"`
3. Within 1-2 minutes, GAS should change it to "COMPLETED"
4. A Slack notification should appear with the ordering doc link
5. Check the **Audit Log** for "WARATAH - EXPORT ORDERING DOC"

---

## How to Regenerate an Ordering Doc

1. Open the **Count Sessions** table
2. Find the session with `Ordering Export State = "COMPLETED"`
3. Clear the `Ordering Export State` field (delete the value)
4. Press the "Export Ordering Doc" button again
5. The state will be set to "REQUESTED" and GAS will regenerate the doc
