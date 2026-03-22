# End-to-End Workflows

**Last Updated:** 2026-03-22
**Audience:** Operations Manager maintaining The Waratah PREP system

---

## 1. Weekly Prep and Stock Count Cycle

This is the full weekly cycle, from Saturday reset through to prep execution.

### Saturday AM: Clear Weekly Counts

**Script:** `Waratah_ClearWeeklyCount.gs` (Airtable automation)

```
Weekly Counts table is cleared
New placeholder records created for all Batch/Sub Recipe/Garnish/Other items
All records set to Stock Count = 0, Source = "Generated / Placeholder"
```

**What to check:** Open Weekly Counts table. You should see one record per prep item, all with `Stock Count = 0`.

### Saturday-Sunday: Physical Stocktake (Prep Items)

**Manual process:** Bar staff open the Airtable Interface and count every prep item (batches, sub-recipes, garnishes). They enter the current quantity into the `Stock Count` field for each item.

### Sunday 11pm: Finalise Count

**Script:** `Waratah_FinaliseCount.gs` (Airtable automation)

```
All Weekly Count records validated (no blanks allowed)
Recipe integrity check runs (warnings only)
Confirmed = true set on all records
Count Source = "Stocktake (Verified)"
Count Date normalised to consistent timestamp
```

**What to check:** All Weekly Counts should show `Confirmed = true` and `Count Source = "Stocktake (Verified)"`. Check Audit Log for any recipe warnings.

### Sunday 11:15pm: Generate Prep Run

**Script:** `Waratah_GeneratePrepRun.gs` (Airtable automation)

```
Reads verified stock counts
Compares against par levels
Calculates shortfalls for each item
Cascades sub-recipe requirements (two-pass algorithm)
Creates Prep Run record
Creates Prep Task records (what to make)
Creates Ingredient Requirement records (what ingredients are needed)
```

**What to check:** Open Prep Runs table -- new run should exist. Open Prep Tasks -- tasks with Target Qty and Batches Needed. Open Ingredient Requirements -- ingredient records with Total Qty Needed.

### Sunday 11:15pm: Mark Prep Run for Export

**Script:** `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` (Airtable automation)

```
Finds the new Prep Run
Sets Export Request State = "REQUESTED"
```

### Within 5 minutes: GAS Generates Prep Docs

**Script:** `GoogleDocsPrepSystem.gs` (GAS time-trigger)

```
Polls Airtable for REQUESTED Prep Runs
Generates Ingredient Prep List (Google Doc)
Generates Batching Run Sheet (Google Doc)
Sends Slack notifications with doc links
Sets Export Request State = "COMPLETED"
```

**What to check:** Slack channel should have messages with links to two documents. Open the docs and verify they contain the correct tasks and ingredient lists.

### Monday AM: Bar Stock Count

See the Stock Ordering Workflow below.

### Monday Before 2pm: Complete Ordering

Evan uses the Combined Ordering Run Sheet to place orders with suppliers.

### Tuesday: Orders Arrive

Deliveries received and put away.

### Tuesday-Wednesday: Execute Prep

Prep team uses the Ingredient Prep List and Batching Run Sheet to complete all prep tasks.

---

## 2. Stock Ordering Workflow

This is the bar stock ordering pipeline, separate from (but integrated with) the prep cycle.

### Step 1: Initialise Stock Count

**Script:** `Waratah_InitStockCount.gs` (Airtable automation or manual button)

```
Creates new Count Session with status "Not Started"
Creates ~59 Stock Count placeholder records (one per Core Order item)
Pre-fills "Previous Count" from last completed session
Deletes ALL old Stock Count and Stock Order records
Sets session status to "In Progress"
```

**What to check:** Count Sessions table has a new session at "In Progress". Stock Counts table has ~59 records linked to it. Stock Orders table is empty.

### Step 2: Physical Count (Manual)

Evan walks 5 areas and enters counts for each item:

| Area | Locations Covered |
|------|------------------|
| Public Bar | Under PB Station, PB Backbar, PB Fridge |
| Terrace Bar | Under TB Station, TB Backbar, TB Fridge |
| Banquettes | Banquettes, Freezer |
| Cool Rooms | Hallway, Keg Room, Cool Room |
| Back Storage | B1 |

Each item has 5 tally columns (one per area) plus a `Total On Hand` formula that sums them. Evan enters per-area counts in the Airtable Stock Count interface.

### Step 3: Complete Stock Count

**Script:** `Waratah_CompleteStockCount.gs` (Airtable button)

```
Pre-flight check: are all items counted? (Total On Hand not null)
If any items uncounted: BLOCKED (list shown in console)
If all counted: sets session status to "Completed"
Triggers ValidateStockCount automation
```

**What to check:** If blocked, the console output lists uncounted items. Fix them and try again.

### Step 4: Validate Stock Count

**Script:** `Waratah_ValidateStockCount.gs` (auto-triggered by status change)

```
Checks for:
  - Not counted items (Total On Hand = null) -- blocks validation
  - Negative quantities -- blocks validation
  - Outliers (count > 3x or < 0.2x previous) -- flags for review
Flags records with "Needs Review" checkbox
Sets session to "Validated" or "Needs Review"
```

**What to check:** Session status should be "Validated". If "Needs Review", check the flagged Stock Count records and fix or acknowledge the outliers. You can manually set the session to "Validated" if the counts are correct.

### Step 5: Generate Stock Orders

**Script:** `Waratah_GenerateStockOrders.gs` (auto-triggered or manual)

```
Aggregates stock counts by item
Looks up par levels and prep usage from latest Prep Run
Calculates: Combined Order = MAX(0, Par - On Hand) + Prep Usage
Deletes any existing Stock Orders for this session
Creates new Stock Order records
Sets session to "Orders Generated"
Sets Ordering Export State = "REQUESTED" (auto-triggers doc generation)
```

**What to check:** Stock Orders table populated with order quantities. Session shows "Orders Generated" and "Ordering Export State = REQUESTED".

### Step 6: Ordering Doc Generated

**Script:** `GoogleDocsPrepSystem.gs` (GAS polling, `processOrderingExportRequests()`)

```
Polls Count Sessions for Ordering Export State = "REQUESTED"
Fetches Stock Orders + prep-only items
Groups by supplier
Generates Combined Ordering Run Sheet (Google Doc)
Sends Slack notification
Sets Ordering Export State = "COMPLETED"
```

**What to check:** Slack notification with ordering doc link. Open the doc and verify supplier groupings and quantities.

### One-Button Pipeline Summary

After InitStockCount and counting, the rest is automated:

```
[Press "Complete Stock Count" button]
  --> Completed
  --> [auto] ValidateStockCount --> Validated
  --> [auto] GenerateStockOrders --> Orders Generated + REQUESTED
  --> [GAS polls 1-2 min] --> Combined Ordering Run Sheet generated
  --> Slack notification sent
```

---

## 3. Prep Run Workflow (Detailed)

```
Waratah_ClearWeeklyCount.gs (Sat AM)
  |
  | Clears Weekly Counts table
  | Creates placeholders for all prep items
  |
  v
[Manual] Bar staff enter prep stocktake counts (Sat-Sun)
  |
  v
Waratah_FinaliseCount.gs (Sun 11pm)
  |
  | Validates all counts (no blanks)
  | Sets Confirmed = true, Source = "Stocktake (Verified)"
  | Runs recipe integrity check
  |
  v
Waratah_GeneratePrepRun.gs (Sun 11:15pm)
  |
  | Reads verified counts
  | Calculates shortfalls (par - on hand)
  | Creates Prep Run + Prep Tasks + Ingredient Requirements
  |
  v
Waratah_GeneratePrepSheet_TimeBasedPolling.gs (Sun 11:15pm)
  |
  | Sets Export Request State = "REQUESTED" on Prep Run
  |
  v
GoogleDocsPrepSystem.gs (GAS polls every 1-2 min)
  |
  | Detects REQUESTED
  | Generates Ingredient Prep List (Google Doc)
  | Generates Batching Run Sheet (Google Doc)
  | Sends Slack notification with doc links
  | Sets Export Request State = "COMPLETED"
  |
  v
[Monday AM] Bar staff receive Slack notification, use docs for prep
```

---

## 4. Recipe Scaling Workflow

### When Bar Staff Use It

The Recipe Scaler is used when bar staff need to make a non-standard quantity of a recipe. For example:
- The prep doc says to make 2000ml of Citrus Oleosaccharum, but you only have enough lemons for 1500ml
- You need to double a recipe because of a large event
- You want to make a test batch at half scale

### How It Works

1. Bar staff open the Recipe Scaler URL (from a link in the prep doc, or from the Slack message)
2. Select a recipe from the dropdown
3. Enter the target quantity (e.g., 1500ml)
4. The scaler shows all ingredient quantities adjusted for the new yield
5. Staff follow the scaled recipe

### Where to Find It

- URL is stored in Script Property `RECIPE_SCALER_URL`
- Accessible via `?page=scaler` on the web app URL
- Can be pre-filled with `?page=scaler&recipeId=recXXX`

---

## 5. Feedback Collection Workflow

### How Feedback Flows

1. Bar staff encounter an issue with a prep document (wrong quantity, missing ingredient, unclear instructions)
2. They open the Feedback Form (link in prep doc or Slack)
3. Fill in:
   - Feedback type (Missing Data, Recipe Issue, Suggestion, Other)
   - Document type (Ingredient Prep List, Batching List, Andie Ordering, Blade Ordering)
   - Staff role
   - Description of the issue
   - Optionally search for the specific item or recipe
4. Submit the form
5. Feedback is:
   - Saved to the `Feedback` table in Airtable
   - Sent as a Slack notification to the admin channel
6. Management reviews feedback and makes corrections in Airtable (updating recipes, par levels, etc.)

---

## 6. Troubleshooting a Failed Run

### Prep Docs Not Generated

**Symptoms:** No Slack notification, no documents appearing.

**Check these in order:**

1. **Prep Run exists?** Open Prep Runs table in Airtable. Is there a run with today's date?
   - If no: GeneratePrepRun failed. Check Audit Log for errors.
   - If yes: continue to step 2.

2. **Export Request State?** On the Prep Run, what is the `Export Request State`?
   - Empty/null: GeneratePrepSheet did not run. Check the automation.
   - "REQUESTED": GAS has not picked it up yet. Check step 3.
   - "COMPLETED": Docs were generated. Check Slack and the Drive folder.
   - "ERROR": GAS failed. Check `Export Last Error` field.

3. **GAS triggers running?** Open the GAS editor --> Triggers.
   - Is `processExportRequests` listed as a time-driven trigger?
   - Is it enabled (not paused)?
   - Check Executions for recent runs and errors.

4. **Airtable credentials valid?** In GAS Script Properties:
   - Is `AIRTABLE_PAT` set and not expired?
   - Is `AIRTABLE_BASE_ID` correct (`appfcy14ZikhKZnRS`)?

5. **Slack webhook valid?** Try sending a test message to the webhook URL using curl or Postman.

### Ordering Doc Not Generated

**Symptoms:** Stock orders created, but no ordering doc or Slack notification.

1. **Ordering Export State?** On the Count Session, check `Ordering Export State`:
   - Empty: GenerateStockOrders did not set it. Check Audit Log.
   - "REQUESTED": GAS has not processed it. Check step 2.
   - "COMPLETED": Doc was generated. Check Slack.
   - "ERROR": GAS failed. Check GAS Executions log.

2. **GAS trigger running?** Check that `processOrderingExportRequests` has a time-driven trigger in GAS.

3. **To retry:** Clear the `Ordering Export State` field, then press the "Export Ordering Doc" button in Airtable, or re-run GenerateStockOrders.

### Stock Count Stuck at "Needs Review"

1. Open the Stock Counts table
2. Filter for `Needs Review = true`
3. Review each flagged item:
   - Is the count correct? (Compare against Previous Count)
   - Was an area missed? (Check tally columns)
4. Fix any incorrect counts
5. Either:
   - Re-run CompleteStockCount (re-triggers validation), OR
   - Manually change the Count Session status to "Validated"

### Prep Run Shows Wrong Quantities

1. Check **Par Levels** table -- are par levels correct for the items in question?
2. Check **Weekly Counts** -- are the stock counts accurate?
3. Check **Recipes** -- does each recipe have the correct `Yield Qty`?
4. Check **Recipe Lines** -- do ingredients have correct quantities?
5. Re-run GeneratePrepRun (it will rebuild the existing run, deleting old tasks/requirements)

### "Library with identifier X is missing" in GAS

This means the GAS project's remote manifest references a deleted library.

**Fix:**
```bash
cd "The Waratah/scripts"
clasp push --force
```

The `--force` flag overwrites the remote `appsscript.json` with the local one, which has `"dependencies": {}`.

---

## Quick Reference: Script Execution Order

### Prep Cycle (Automated -- Sunday Night)
```
1. Waratah_ClearWeeklyCount.gs (Sat AM)
2. [Manual counting Sat-Sun]
3. Waratah_FinaliseCount.gs (Sun 11pm)
4. Waratah_GeneratePrepRun.gs (Sun 11:15pm)
5. Waratah_GeneratePrepSheet_TimeBasedPolling.gs (Sun 11:15pm)
6. GoogleDocsPrepSystem.gs processExportRequests() (GAS polls)
```

### Stock Ordering (Manual Trigger -- Monday)
```
1. Waratah_InitStockCount.gs (Monday AM -- button)
2. [Manual counting Monday]
3. Waratah_CompleteStockCount.gs (button)
4. Waratah_ValidateStockCount.gs (auto-triggered)
5. Waratah_GenerateStockOrders.gs (auto-triggered)
6. GoogleDocsPrepSystem.gs processOrderingExportRequests() (GAS polls)
```

### Manual Re-trigger for Ordering Doc
```
1. Clear "Ordering Export State" on Count Session
2. Waratah_ExportOrderingDoc.gs (button)
3. GoogleDocsPrepSystem.gs processOrderingExportRequests() (GAS polls)
```
