# Troubleshooting Quick Reference

Quick fixes for common PREP system issues. For detailed technical troubleshooting, see [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md).

---

## Staff Issues
*Common problems reported by kitchen staff and how to fix them.*

### "I entered the wrong stock count"
**Fix:** Update it in the **Stock Count Interface**. This works any time before the manager clicks "Finalise Count" during Saturday shift. You don't need to open the raw Weekly Counts table — just correct the number in the Interface.

### "I didn't get my Slack message"
**Check:**
1. Was the export run in TEST mode? (TEST sends to dev channel only)
2. Ask your manager to check the export status in the Interface (or the Prep Runs table if needed)
3. If it says "FAILED", the manager needs to re-trigger the export

### "My ordering list is missing a supplier"
**Check:** The supplier may not have any items below par this week. If the item genuinely needs ordering, check Par Levels are set correctly.

### "Quantities look wrong on my list"
**Check:**
1. Was the stock count entered correctly?
2. Is the par level correct? (Check via the Interface, or the Par Levels table for admin access)
3. Is the recipe yield correct? (Recipes table)
4. Remember: displayed quantities include a 1.5x buffer

---

## Manager Issues
*Fixes for export failures, missing data, and notification problems.*

### Export stuck in "Processing"
**Symptoms:** Prep Run Request shows "Processing" for more than 5 minutes.

**Fix:**
1. Check Audit Log table for errors
2. Check GAS execution log (script.google.com → Executions)
3. Set the request status back to "Pending" to retry
4. If repeated failures, check webhook URL in Script Properties

### "Finalise Count" shows warnings
**Common warnings:**
- "Item has no stock count" — staff missed counting that item
- "Recipe integrity issue" — recipe or yield is missing for an item

**These are warnings, not errors.** The system continues processing. Fix the underlying data for next week.

### Items not appearing in prep tasks
**Check this sequence (admin table access may be needed for some checks):**
1. Is the item Active? (Items table → Active checkbox)
2. Does the item have a Par Level? (Par Levels table)
3. Was the item included in the stocktake? (Check the Interface or Weekly Counts table)
4. Does the item have a Recipe with a Yield Qty? (Recipes table)
5. Is the stock count actually below par?
6. v3.0: Is the stock below the item's reorder point? (Items with Weekly Volume use dynamic reorder points)

### No documents created after export
**Check:**
1. Audit Log for errors from "GoogleDocsPrepSystem"
2. GAS execution log for timeout errors (6-minute limit)
3. Script Properties: `DOCS_FOLDER_ID` is set and the folder exists
4. Template IDs are valid (if using templates)

### Slack notifications not sending
**Check:**
1. Export mode — TEST only sends to test channel
2. "Export Notify Slack" checkbox on the Prep Run
3. Webhook URLs in Script Properties are valid
4. Run a test export first to verify

---

## Developer Issues
*GAS deployment errors, API rate limits, and script timeouts.*

### "Library with identifier X is missing"
**Cause:** GAS project references a deleted library.
**Fix:** `cd "Sakura House/scripts" && clasp push --force` — the local `appsscript.json` with `"dependencies": {}` overwrites the remote.

### clasp push uploads wrong files
**Check:** `.claspignore` should exclude all Airtable-only scripts:
```
ClearWeeklyCount.gs
ClearPrepData.gs
FinaliseCount.gs
GeneratePrepRun.gs
GeneratePrepSheet.gs
GoogleDocsPrepSystem_TestHarness.gs
```

Run `clasp status` to verify what will be pushed.

### Rate limiting from Airtable
**Cause:** More than 5 requests/second to Airtable API.
**Fix:** All scripts use batch sizes of 50 records with delays between batches. If you're hitting limits, increase the delay between batch operations.

### Google Docs generation timeout
**Cause:** GAS has a 6-minute execution limit.
**Fix:** Check if prep run has unusually many tasks. Consider splitting into smaller exports or optimising document generation.

---

## Quick Diagnostic Checklist

When something goes wrong, check in this order:

1. **Interface** — check the export status and any visible errors
2. **Audit Log** — most recent entry for the failing script (admin access)
3. **Prep Runs table** — Export Request State field (admin access)
4. **GAS Execution Log** — script.google.com → select project → Executions
5. **Script Properties** — all required properties set?
6. **Airtable data** — are the source records correct?

---

## Contacts
*Who to reach out to depending on the issue type.*

| Issue Type | Who to Ask |
|-----------|-----------|
| Stock count questions | Your team lead |
| Par level adjustments | Manager |
| System errors / export failures | System admin |
| Recipe corrections | Use the feedback form |
