# ClearPrepData.gs -- Script Explainer

**Version:** 1.0
**Runs in:** Airtable Automation
**Trigger:** Scheduled -- Friday 8:00 AM Sydney time
**Last Updated:** 2026-03-22

---

## What It Does

ClearPrepData deletes all records from two tables:

1. **Prep Tasks** -- the individual prep tasks generated during the previous week's cycle
2. **Ingredient Requirements** -- the calculated ingredient quantities from the previous week

This is a cleanup script. It removes last week's data so it does not accumulate and clutter the system. Think of it as clearing the whiteboard before starting a new week.

**Important:** This script does NOT touch Items, Recipes, Par Levels, Weekly Counts, or any other table. It only deletes records from Prep Tasks and Ingredient Requirements.

---

## When and Why It Runs

- **When:** Every Friday at 8:00 AM, automatically (scheduled Airtable automation)
- **Why:** By Friday, the previous week's prep is complete. The Prep Tasks and Ingredient Requirements from that cycle are no longer needed. Clearing them prevents confusion when the new cycle starts Saturday.

If you ever need to keep the previous week's data for reference, you can skip this automation or set `dryRun: true` in the automation configuration.

---

## CONFIG Object Explained

At the top of the script, the `CONFIG` object defines table and field names:

| Setting | Value | What It Means |
|---------|-------|---------------|
| `timeZone` | `"Australia/Sydney"` | Timestamps are formatted in Sydney time |
| `tasksTableName` | `"Prep Tasks"` | The Airtable table where prep tasks are stored |
| `reqTableName` | `"Ingredient Requirements"` | The Airtable table where ingredient needs are stored |
| `auditLogTableName` | `"Audit Log"` | Where the script logs its execution results |
| `batchSize` | `50` | Airtable deletes records in chunks of 50 (API limit) |
| `scriptName` | `"CLEAR PREP DATA"` | How this script identifies itself in the Audit Log |

If the table names in Airtable ever change, you must update these values to match. Mismatched names will cause the script to fail with a "table not found" error.

---

## Phase-by-Phase Walkthrough

### Phase 1: Delete all Prep Tasks

1. Opens the "Prep Tasks" table
2. Queries ALL records in the table (no filters -- it gets everything)
3. Collects all record IDs
4. Deletes them in batches of 50

The batch delete has a fallback: if a batch delete fails (e.g., a record was already deleted), it falls back to deleting records one by one, skipping any that are already gone.

### Phase 2: Delete all Ingredient Requirements

Same process as Phase 1, but for the "Ingredient Requirements" table.

### Phase 3: Summary + Audit Log

1. Calculates total execution time
2. Logs the results to the console
3. Writes a record to the Audit Log table with:
   - Script Name: "CLEAR PREP DATA"
   - Status: "SUCCESS" (or "ERROR" if something went wrong)
   - Message: How many records were deleted
   - Execution Time: How long the script took

---

## Automation Inputs

The script accepts one optional input from the Airtable automation configuration:

| Input | Type | Default | What It Does |
|-------|------|---------|--------------|
| `dryRun` | boolean | `false` | If `true`, the script reports what it would delete but does not actually delete anything |

To set `dryRun` to `true`: open the automation in Airtable, find the "Run script" action, and add an input variable named `dryRun` with the value `true`.

---

## What Could Go Wrong

### "Table not found" error
- **Cause:** The table name in the script does not match the table name in Airtable
- **Fix:** Check that "Prep Tasks" and "Ingredient Requirements" tables exist in the base with exactly those names (case-sensitive)

### Script runs but deletes 0 records
- **This is normal** if the tables were already empty (e.g., someone manually cleared them, or the script ran twice)

### "Audit Log table not found" warning
- **Cause:** The "Audit Log" table does not exist in the base
- **Impact:** Non-critical. The script will still delete records; it just will not log its execution
- **Fix:** Create an "Audit Log" table with the required fields (Timestamp, Script Name, Status, Message, Details)

### Script fails partway through
- **Impact:** Some records may have been deleted from Prep Tasks, but Ingredient Requirements may still be intact (or vice versa)
- **Fix:** Just run the automation again. The batch delete handles already-deleted records gracefully.

---

## How to Check If It Worked

1. **Check the Audit Log table:** Look for a record with Script Name = "CLEAR PREP DATA" and Status = "SUCCESS"
2. **Check Prep Tasks table:** Should be empty (0 records)
3. **Check Ingredient Requirements table:** Should be empty (0 records)
4. **Check the automation history:** In Airtable, go to Automations, find this automation, and check the run history. Each run shows console output and success/failure status.

---

## How to Edit This Script in Airtable

1. Open the Airtable base: `https://airtable.com/appNsFRhuU47e9qlR`
2. Go to the **Automations** tab (top navigation bar)
3. Find the automation named something like "Friday AM: Clear Prep Data" or similar
4. Click on it to expand it
5. Click on the "Run script" action step
6. The code editor will open -- you can see and edit the script here
7. After making changes, click "Test" to do a dry run, then enable the automation

**Tip:** Before pasting updated code, copy the existing code to a text file as a backup. If the new code has issues, you can revert by pasting the backup back in.
