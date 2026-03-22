# FinaliseCount.gs -- Script Explainer

**Version:** 2.0
**Runs in:** Airtable Automation
**Trigger:** Interface button ("Finalise Count")
**Last Updated:** 2026-03-22

---

## What It Does

FinaliseCount validates and locks the stocktake. It performs three key actions:

1. **Validates** that every Weekly Count record has a Stock Count value (rejects blanks)
2. **Finalises** all unconfirmed records by setting `Confirmed = true` and stamping a normalised Count Date
3. **Runs a recipe integrity check** (optional) to warn about data issues before prep generation

Once this script runs successfully, the stocktake is "locked" -- the Confirmed flag tells the rest of the system that these counts are verified and ready to use.

---

## When and Why It Runs

- **When:** Saturday night shift, after staff have finished counting all stock. The manager clicks "Finalise Count" in the Airtable Interface.
- **Why:** The system needs to know that the stocktake is complete before it can calculate shortfalls. Finalising acts as a "sign-off" step -- it prevents the system from using incomplete or unverified counts.

**Sequence:** ClearWeeklyCount (creates placeholders) --> Staff count stock --> **FinaliseCount** --> GeneratePrepRun

---

## Automation Inputs

| Input | Type | Default | What It Does |
|-------|------|---------|--------------|
| `dryRun` | boolean | `false` | If `true`, reports what would happen without making changes |
| `skipRecipeValidation` | boolean | `false` | If `true`, skips the recipe integrity check |

---

## Phase-by-Phase Walkthrough

### Recipe Integrity Check (runs first if enabled)

Before finalising, the script optionally checks recipe data for problems:

- **Broken recipe links:** Recipe Lines pointing to items that no longer exist
- **Missing recipes:** Batch or Sub Recipe items that have no recipe assigned
- **Zero yield recipes:** Recipes with Yield Qty = 0 (causes division-by-zero errors later)
- **Missing yield values:** Recipes with no Yield Qty at all

These checks produce **warnings only** -- they do not block finalisation. The warnings are logged to the Audit Log so you can fix them before running GeneratePrepRun.

### Phase 1: Fetch All Weekly Counts

Queries all records in the Weekly Counts table, loading Stock Count, Count Date, Count Source, Confirmed, and Item link fields.

### Phase 2: Filter for Unconfirmed Records

Identifies records where `Confirmed` is not `true`. The script only processes unconfirmed records -- any previously confirmed records are left untouched.

If all records are already confirmed, the script exits cleanly with "Nothing to Do".

**Smart filtering:** If there are records with Count Source = "Stocktake (Verified)", the script prioritises those. This prevents accidental finalisation of records from other sources.

### Phase 3: Validate Stock Counts

Checks every target record for blank Stock Count values. This is the most critical validation:

- **Blank = REJECTED.** The script throws an error listing all items with blank counts (up to 25 items shown).
- **Zero = ACCEPTED.** A Stock Count of 0 is valid (it means "we have none of this item").

If any blanks are found, the error message tells the manager exactly which items need values, and the script stops without making any changes.

### Phase 4: Prepare Finalisation

1. Gets the current timestamp
2. Normalises it to minute precision (removes seconds/milliseconds for consistency)
3. Prepares update records: each one sets `Confirmed = true` and `Count Date = normalised timestamp`

### Phase 5: Execute Updates

Applies the updates in batches of 50. After this step, all records are confirmed and have a uniform timestamp.

### Phase 6-7: User Capture + Summary

Identifies who triggered the automation (from the Last Modified By field) and logs the results.

### Output Variables

- `status`: "success" or "warning" (if recipe issues found)
- `targetCount`: number of records finalised
- `countDateWritable`: the Count Date that was applied (Sydney time)
- `recipeIssuesFound`: boolean -- whether recipe warnings were detected
- `recipeIssuesCount`: number of recipe issues found

---

## What Could Go Wrong

### "Cannot finalize: X items have blank Stock Count"
- **Cause:** Staff did not enter counts for some items
- **Fix:** Go to the Weekly Counts table or Interface, find the items listed in the error, enter their Stock Count values (even 0 is fine), then click "Finalise Count" again

### "No VERIFIED stocktake found" (in later scripts)
- **Cause:** FinaliseCount did not run, or it was run in dry-run mode
- **Fix:** Run FinaliseCount in live mode first

### Recipe integrity warnings appear
- **Impact:** Finalisation still completes (warnings do not block it)
- **Action:** Check the Audit Log for details. Fix any recipe issues in the Recipes and Recipe Lines tables before running GeneratePrepRun, or the prep generation may produce incorrect results.

### Script times out
- **Cause:** Very large number of records (unlikely at Sakura scale)
- **Fix:** Re-run the script. Airtable automations have execution time limits (typically 30 seconds for scripting actions). If the base has grown significantly, contact your developer.

---

## How to Check If It Worked

1. **Check the Audit Log:** Look for "FINALISE COUNT" with Status = "SUCCESS" (or "WARNING" if recipe issues were found)
2. **Check Weekly Counts table:** All records should now show Confirmed = true
3. **Check the count date:** All records should have the same Count Date (within the same minute)
4. **Interface feedback:** The Airtable Interface should update to show "Count Finalised" or similar status

---

## How to Edit This Script in Airtable

1. Open the Airtable base: `https://airtable.com/appNsFRhuU47e9qlR`
2. Go to the **Automations** tab
3. Find the automation connected to the "Finalise Count" button
4. Click the "Run script" action step to open the code editor
5. Edit the code, then click "Test" to verify

**Be careful with:** The `CONFIG.verifiedSourceName` value ("Stocktake (Verified)"). If you change the Count Source values in your Single Select field options, this string must match exactly.
