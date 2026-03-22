# End-to-End Workflows

**Last Updated:** 2026-03-22
**Audience:** Operations Manager

---

## 1. Weekly Prep Cycle

This is the primary workflow. It runs every week, Friday through Saturday.

### Friday 8:00 AM -- Cleanup (Automated)

**What happens:** ClearPrepData runs automatically on its Friday morning schedule.

1. ClearPrepData deletes all records from the Prep Tasks table
2. ClearPrepData deletes all records from the Ingredient Requirements table
3. A "SUCCESS" entry appears in the Audit Log

**Decision point:** Did it succeed?
- **YES:** No action needed. The system is clean for the new week.
- **NO:** Check the Audit Log for errors. The most common issue is a table rename. You can also run it manually from the Automations tab.

**How to verify:**
- Check the Audit Log for "CLEAR PREP DATA" with Status = "SUCCESS"
- Open Prep Tasks table -- should be empty
- Open Ingredient Requirements table -- should be empty

---

### Saturday 8:00 AM -- Reset Counts (Automated)

**What happens:** ClearWeeklyCount runs automatically on its Saturday morning schedule.

1. All existing Weekly Counts records are deleted
2. The Items table is queried for active Batch, Sub Recipe, Garnish, and Other items
3. One placeholder record is created per item (Stock Count = 0, Confirmed = false)

**Decision point:** Did it succeed?
- **YES:** The stocktake view in the Airtable Interface now shows all items ready to count.
- **NO:** Check the Audit Log. If it failed, you can run it manually from the Interface button.

**How to verify:**
- Check the Audit Log for "CLEAR WEEKLY COUNT" with Status = "SUCCESS"
- Open the stocktake Interface -- all items should show Stock Count = 0

---

### Saturday Night Shift (3:30 PM onwards) -- Count Stock

**What happens:** Staff physically count stock and enter values in the Airtable Interface.

1. Staff open the stocktake Interface on their phones or tablets
2. For each item, they enter the actual stock count
3. Items they did not count remain at 0

**Decision points:**
- **All items counted?** YES --> proceed to Finalise. NO --> count the remaining items.
- **Any items showing blank (null) instead of 0?** Blanks will cause FinaliseCount to reject the submission. Enter 0 if there is none.

**How to verify:**
- Scan the stocktake Interface for any items still at 0 that should have stock
- Ask staff if they missed any sections

---

### Saturday Night Shift -- Finalise Count (Manual)

**What happens:** The manager clicks "Finalise Count" in the Airtable Interface.

1. FinaliseCount checks for blank Stock Count values
2. If any are blank --> **STOPS** with an error listing the blank items
3. If all have values --> sets Confirmed = true on all records
4. Stamps a uniform Count Date on all records
5. Runs a recipe integrity check (optional)

**Decision points:**
- **"Cannot finalize: X items have blank Stock Count"** --> Go back and fill in the blanks (0 is fine, blank is not), then click Finalise again
- **Recipe warnings appear** --> These are non-blocking. Note them down. Fix before running GeneratePrepRun if possible, but they will not prevent finalisation.

**How to verify:**
- Check the Audit Log for "FINALISE COUNT" with Status = "SUCCESS" (or "WARNING")
- All Weekly Counts records should show Confirmed = true
- All Count Dates should be the same

---

### Saturday Night Shift -- Generate Prep Run (Manual)

**What happens:** The manager clicks "Generate Prep Run" in the Airtable Interface.

1. GeneratePrepRun finds the latest verified stocktake
2. Calculates shortfalls (Par - Stock)
3. Applies reorder point logic (items above reorder point are skipped)
4. Calculates batches needed for each recipe
5. Cascades demand through sub-recipes
6. Creates Prep Task records
7. Creates Ingredient Requirement records
8. Links everything to a new (or existing) Prep Run record

**Decision points:**
- **"No VERIFIED stocktake found"** --> FinaliseCount was not run. Go back and run it.
- **"Broken Recipe Lines detected"** --> A recipe references a deleted item. Fix the recipe link in the Recipe Lines table.
- **Tasks created but some items were skipped** --> Check the Audit Log details. Items above their reorder point are listed. This is normal and intentional.
- **Task counts or quantities seem wrong** --> Check Par Levels, Weekly Volume values, and Recipe Yield values.

**How to verify:**
- Check the Audit Log for "GENERATE PREP RUN" with Status = "SUCCESS"
- Open Prep Tasks table -- should have records
- Open Ingredient Requirements table -- should have records
- Check the Prep Runs table for a new record with today's date

---

### Saturday Night Shift -- Export Prep Sheet (Manual)

**What happens:** The manager clicks "Export Prep Sheet" in the Airtable Interface.

1. GeneratePrepSheet marks the Prep Run's Export Request State as "REQUESTED"
2. GoogleDocsPrepSystem (in GAS) detects the request
3. GAS reads all prep data from Airtable
4. GAS generates 4 Google Docs in a dated folder
5. GAS sends Slack notifications with document links
6. The Prep Run record is updated with a link to the folder

**Decision points:**
- **Export Request State stays at "REQUESTED" for more than 5 minutes** --> Check GAS execution logs. The most common causes are: expired Airtable PAT, missing Script Properties, GAS project quota exceeded.
- **Docs generated but Slack notifications not sent** --> Check the Slack webhook URLs in Script Properties. Webhooks can expire.
- **Docs have no content** --> GeneratePrepRun did not create tasks/requirements. Go back and check that step.

**How to verify:**
- Check Slack for the document notification messages
- Click a document link -- it should open a formatted Google Doc
- Check the Prep Runs table -- "Link to Prep Guides" should have a URL
- Check the GAS Executions log for success

---

### Saturday Night -- Ordering

**What happens:** Gooch and Sabs use their ordering documents to place orders.

1. Gooch opens the "Gooch Ordering List" Google Doc (link from Slack or the Prep Run record)
2. For each supplier listed, places orders via email, portal, or phone
3. Checks the "NEEDS ASSIGNMENT" section -- these items need supplier/staff assignment in Airtable
4. Checks the "NEGLIGIBLE STOCK DECREMENTS" section -- these items likely have stock on hand and should be verified before ordering
5. Sabs does the same with the "Sabs Ordering List"

**Decision points:**
- **Items appear in "NEEDS ASSIGNMENT"** --> Open the Items table in Airtable, find the item, and set its Supplier and Ordering Staff fields
- **Quantities seem too high or too low** --> The 1.5x buffer adds 50% to all quantities. Use the base quantity (the bold/underlined number) as the actual need. The buffered number is a safety margin.

---

### Sunday -- Wednesday -- Deliveries + Prep

1. **Sunday-Monday:** First round of orders arrives. Extra ordering may be needed.
2. **Tuesday-Wednesday:** Remaining orders arrive. Prep team works through the Batching List and Ingredient Prep List.

Staff use:
- **Batching List** -- follow recipes to make each batch item
- **Ingredient Prep List** -- prepare sub-recipes (grouped under their parent batch)
- **Recipe Scaler** -- if they have less of an ingredient than expected, use the scaler link to adjust quantities

---

## 2. Ordering Workflow

### Who Orders What

| Person | Responsibility | Document |
|--------|---------------|----------|
| **Gooch** | Suppliers assigned to Gooch in the Supplier table | Gooch Ordering List |
| **Sabs** | Suppliers assigned to Sabs in the Supplier table | Sabs Ordering List |

### How Supplier Assignment Works

1. Each supplier record in the Supplier table has an "Ordering Staff" field
2. This field is set to either "Gooch" or "Sabs"
3. When GoogleDocsPrepSystem generates ordering docs, it reads each Ingredient Requirement's supplier and ordering staff
4. Items are sorted into the correct person's document

### What If a Supplier Has No Staff Assigned?

The item appears in the "NEEDS ASSIGNMENT" section at the bottom of BOTH ordering docs. To fix:
1. Open the Supplier table in Airtable
2. Find the supplier
3. Set the "Ordering Staff" field to "Gooch" or "Sabs"
4. Re-export the prep sheet to regenerate the docs with correct assignment

### Negligible Stock Decrements

Items where the needed quantity is very small compared to the order unit size (less than 5% of a full order unit) are flagged as "negligible". For example, if you need 50ml of something but the order unit is 5000ml, you almost certainly have enough on hand.

These items are separated into their own section so ordering staff can verify before placing unnecessary orders.

---

## 3. Recipe Scaling Workflow

### When to Use

Staff use the Recipe Scaler when they have less of an ingredient than the document specifies. This is common when:
- A delivery was short
- Stock was used between counting and prepping
- An ingredient is partially spoiled

### How to Use

1. In the Batching List or Ingredient Prep List, click the "Scale this recipe" link next to the recipe name
2. The Recipe Scaler opens with the recipe pre-selected
3. Select the constraining ingredient (the one you have limited stock of)
4. Enter the amount you have available
5. The scaler shows adjusted quantities for all ingredients and the resulting yield

### Example

The Batching List says to make "Yuzu Sour" with:
- 500ml Yuzu Juice
- 300ml Sugar Syrup
- 200ml Water

But you only have 350ml of Yuzu Juice. Using the scaler:
- Scale factor: 350/500 = 0.7 (70%)
- Yuzu Juice: 350ml (your constraint)
- Sugar Syrup: 210ml
- Water: 140ml
- Yield: 70% of original

---

## 4. Feedback Collection Workflow

### How Feedback Flows

1. Staff find an issue with a generated document (wrong quantity, missing ingredient, etc.)
2. They click the "Have feedback? Submit here" link in the document
3. The Feedback Form opens with the document type and prep run pre-filled
4. They fill in their name, feedback type, and description
5. Optionally they search for the specific item or recipe reference
6. They submit

### What Happens After Submission

1. The AI triage categorises the feedback (Data Fix, Recipe Update, or General)
2. A record is created in the Feedback table in Airtable
3. A Slack notification is sent to the admin channel with the full details and triage result
4. The manager reviews and takes action

### Managing Feedback

1. Open the Feedback table in Airtable
2. New submissions have Status = "New"
3. Review each item and update the Status as you work through them
4. Use the AI Suggestion field as a starting point for investigation

---

## 5. Troubleshooting a Failed Run

When something goes wrong during the Saturday shift, follow this diagnostic sequence:

### Step 1: Identify Which Script Failed

Check the Audit Log table in Airtable. Look for the most recent entry with Status = "ERROR".
- If it is "FINALISE COUNT" -- go to Step 2a
- If it is "GENERATE PREP RUN" -- go to Step 2b
- If there is no error in Audit Log -- the failure is in the GAS export. Go to Step 2c.

### Step 2a: FinaliseCount Failed

**Most common cause:** Blank Stock Count values.

1. Read the error message -- it will list which items have blanks
2. Open the Weekly Counts table (or Interface)
3. Find the listed items and enter their Stock Count (0 is fine)
4. Click "Finalise Count" again

**Less common:** Recipe integrity issues. These are warnings, not blockers. Check the Audit Log details.

### Step 2b: GeneratePrepRun Failed

**Common causes:**

- "No VERIFIED stocktake found" -- FinaliseCount has not run. Run it first.
- "Verified stocktake has blanks" -- Some items have Confirmed = true but no Stock Count. Fix the data and re-run FinaliseCount.
- "Broken Recipe Lines detected" -- A recipe references a deleted item. The error message lists the broken links. Fix them in the Recipe Lines table.
- Script timed out -- This can happen if the base has grown significantly. Contact your developer.

### Step 2c: GAS Export Failed

1. Open the GAS editor: `https://script.google.com/d/1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM/edit`
2. Click **Executions** in the left sidebar
3. Find the most recent failed execution
4. Click on it to read the error log

**Common GAS errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing Script Property: AIRTABLE_PAT" | Property not set | Add it in Project Settings |
| "Airtable GET failed (401)" | PAT expired or incorrect | Generate a new PAT in Airtable |
| "Slack webhook failed" | Webhook URL expired | Create a new webhook in Slack |
| "No Prep Run found" | No runs have tasks/reqs linked | Check that GeneratePrepRun completed |
| LockService timeout | Another export is running | Wait and retry |

### Step 3: Re-Run the Failed Step

After fixing the underlying issue:
1. If FinaliseCount failed -- click "Finalise Count" again
2. If GeneratePrepRun failed -- click "Generate Prep Run" again
3. If GAS export failed -- click "Export Prep Sheet" again (or run the export function directly in the GAS editor)

### Step 4: Verify Recovery

1. Check the Audit Log for a new "SUCCESS" entry
2. Check Slack for document notifications
3. Open one of the generated documents to verify content

---

## Emergency Procedures

### Need to Skip the Automation and Generate Docs Manually?

If the automation pipeline is broken and you cannot fix it before orders need to go out:

1. Use the previous week's documents as a template
2. Manually calculate shortfalls from the raw Weekly Counts data
3. Create ordering lists by hand

This is a last resort. The system is designed so that each step can be re-run safely -- re-running is almost always faster than manual work.

### Need to Re-Run the Entire Cycle?

The scripts are designed to be idempotent (safe to re-run):

1. **ClearPrepData** -- always safe to re-run (just deletes data)
2. **ClearWeeklyCount** -- always safe to re-run (deletes and recreates)
3. **FinaliseCount** -- safe to re-run (skips already-confirmed records)
4. **GeneratePrepRun** -- safe to re-run (detects existing run and rebuilds it)
5. **GeneratePrepSheet + GAS export** -- safe to re-run (trashes old docs and creates new ones)

### Need to Disable a Scheduled Automation?

1. Open Automations tab in Airtable
2. Find the automation
3. Toggle the switch to OFF
4. The automation will not run until you turn it back on
