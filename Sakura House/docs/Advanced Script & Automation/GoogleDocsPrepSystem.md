# GoogleDocsPrepSystem.gs -- Script Explainer

**Version:** 4.2 (Hybrid Template Engine)
**Runs in:** Google Apps Script (GAS)
**Trigger:** Webhook POST from Airtable, or manual test run
**Last Updated:** 2026-03-22

---

## What It Does

GoogleDocsPrepSystem is the main output engine. It:

1. Reads prep data from Airtable (Prep Tasks, Ingredient Requirements, Items, Recipes, Recipe Lines, Suppliers)
2. Generates **4 Google Docs** in a dated folder:
   - **Gooch Ordering List** -- items grouped by supplier for Gooch to order
   - **Sabs Ordering List** -- items grouped by supplier for Sabs to order
   - **Batching List** -- batch recipes with ingredients, quantities, and methods
   - **Ingredient Prep List** -- sub-recipe prep tasks grouped under their parent batch
3. Sends **Slack notifications** with links to each document
4. Updates the Prep Run record with a link to the folder

This is the script that produces the physical documents staff work from all week.

---

## Where It Runs

Unlike the Airtable automation scripts, GoogleDocsPrepSystem runs in Google Apps Script (GAS). It is deployed as a web app, which means it has a URL that can receive HTTP requests.

**Access the GAS editor:**
- URL: `https://script.google.com/d/1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM/edit`
- Or from the command line: `cd "Sakura House/scripts" && clasp open`

---

## How It Is Triggered

### Webhook (Primary Method)

The GAS project is deployed as a web app with a `doPost()` endpoint. When GeneratePrepSheet marks a record as REQUESTED, an Airtable automation sends an HTTP POST to this webhook with:

```json
{
  "secret": "<MANUAL_TRIGGER_SECRET>",
  "runId": "recXXXXXXXX",
  "mode": "LIVE",
  "notifySlack": true
}
```

The secret acts as a password -- it prevents unauthorised callers from triggering document generation.

### Manual Test

You can also trigger a test export directly from the GAS editor:
- Open the GAS editor
- Select the function `exportLatestPrepRunToDocs_TEST`
- Click Run
- This sends all Slack notifications to the test channel instead of individual channels

---

## The Hybrid Template Engine (v4.2)

Documents are generated using a hybrid approach:

### Template Layer (branding)
- Google Docs templates provide the header styling, logo, and visual branding
- Templates contain simple placeholders: `{{DATE}}`, `{{RUN_LABEL}}`, `{{STAFF_NAME}}`, `{{CONTENT}}`
- Template IDs are stored in Script Properties

### Code Layer (content)
- All dynamic content (supplier lists, ingredient lists, recipe methods) is generated programmatically
- The code finds the `{{CONTENT}}` marker in the template and inserts content at that position
- This avoids Google Docs API limitations with nested loops

### Fallback
- If a template is missing or fails to process, the script falls back to fully programmatic document generation (no branding, but all the data is correct)
- This means the system never breaks due to a template issue -- it just looks less polished

---

## Document Details

### Gooch Ordering List and Sabs Ordering List

- Items from the Ingredient Requirements table
- Filtered by ordering staff assignment (Gooch's suppliers vs Sabs' suppliers)
- Grouped by supplier name
- Each supplier section shows:
  - Supplier name as heading
  - Supplier email (or "Portal or Other" if none)
  - Bulleted list of items with quantities
- Items with no supplier or ordering staff assigned appear in a "NEEDS ASSIGNMENT" section

**Negligible Stock Decrements:** Items where the needed quantity is very small relative to the order unit size (less than 5%) are separated into a "NEGLIGIBLE STOCK DECREMENTS" section at the bottom. These likely have stock on hand and should be verified before ordering.

### Batching List

- One heading per Batch task
- Under each heading:
  - All ingredients from the recipe, with quantities
  - Recipe method (if available)
  - Recipe Scaler link (if configured)
  - Task notes (if any)
- Only shows batches that have at least one ingredient with a non-zero quantity

### Ingredient Prep List

- Groups sub-recipe tasks under their parent batch
- Only shows batches that have sub-recipe requirements
- For each sub-recipe:
  - All ingredients from its recipe
  - Method and notes
  - If the same sub-recipe appears under multiple batches, subsequent mentions say "See above"

### Quantity Format

All quantities show the buffer format:

```
100ml (1.5x = 150ml)
```

The base quantity is bold and underlined. The buffered quantity (1.5x) is the safety margin.

The 1.5x multiplier is set in `CFG.bufferMultiplier` and can be changed globally. Individual items can also override this via their "Buffer Multiplier" field in the Items table.

---

## Slack Notification Routing

### LIVE Mode

| Recipient | Gets | Script Property |
|-----------|------|-----------------|
| Kalisha | All 4 docs | `SLACK_WEBHOOK_KALISHA` |
| Evan | All 4 docs | `SLACK_WEBHOOK_EVAN` |
| Gooch | All 4 docs | `SLACK_WEBHOOK_GOOCH` |
| Sabs | All 4 docs | `SLACK_WEBHOOK_SABS` |
| Prep Channel | Ingredient Prep + Batching only | `SLACK_WEBHOOK_PREP` |

### TEST Mode

All notifications go to a single test channel:
- Script Property: `SLACK_WEBHOOK_EV_TEST`

---

## Script Properties Required

This script needs the following Script Properties to be set in the GAS editor:

| Property | Purpose | Example |
|----------|---------|---------|
| `AIRTABLE_BASE_ID` | Sakura Airtable base | `appNsFRhuU47e9qlR` |
| `AIRTABLE_PAT` | Airtable Personal Access Token | `patXXXX...` |
| `DOCS_FOLDER_ID` | Google Drive folder for output | `1abc...` |
| `SLACK_WEBHOOK_KALISHA` | Kalisha's Slack channel | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_EVAN` | Evan's Slack channel | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_GOOCH` | Gooch's Slack channel | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_SABS` | Sabs' Slack channel | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_PREP` | Prep team channel | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_EV_TEST` | Test channel | `https://hooks.slack.com/services/...` |
| `MANUAL_TRIGGER_SECRET` | Webhook auth password | Any secret string |
| `TEMPLATE_ORDERING_ID` | Template doc for ordering lists | Google Docs file ID |
| `TEMPLATE_BATCHING_ID` | Template doc for batching list | Google Docs file ID |
| `TEMPLATE_INGREDIENT_PREP_ID` | Template doc for ingredient prep | Google Docs file ID |
| `FEEDBACK_FORM_URL` | Feedback form web app URL | `https://script.google.com/...` |
| `RECIPE_SCALER_URL` | Recipe Scaler web app URL | `https://script.google.com/...` |

---

## Web App Router

GoogleDocsPrepSystem also serves as the entry point for two web apps:

- `<deployment-url>` or `<deployment-url>?page=feedback` -- serves the Feedback Form
- `<deployment-url>?page=scaler` -- serves the Recipe Scaler

The `doGet()` function routes based on the `page` URL parameter.

---

## What Could Go Wrong

### "Missing Script Property: AIRTABLE_PAT"
- **Cause:** A required Script Property is not set
- **Fix:** Go to GAS editor > Project Settings > Script Properties and add the missing key

### "No Prep Run found"
- **Cause:** GeneratePrepRun has not been run, or the Prep Run has no linked tasks/requirements
- **Fix:** Run GeneratePrepRun first. Check that the Prep Tasks and Ingredient Requirements tables have records.

### "Airtable GET failed (401)"
- **Cause:** The Airtable PAT has expired or is incorrect
- **Fix:** Generate a new PAT in Airtable (Account > Developer hub > Personal access tokens) and update the `AIRTABLE_PAT` Script Property

### "Slack webhook failed (404)" or similar
- **Cause:** A Slack webhook URL has expired (Slack webhook URLs can be revoked if the app is reinstalled)
- **Fix:** Create a new webhook in Slack (App > Incoming Webhooks) and update the relevant Script Property

### Template fails -- docs look plain
- **Not an error** -- the fallback to programmatic generation is by design. Check:
  - Is the template document ID correct?
  - Does the template still exist in Google Drive?
  - Does it contain the `{{CONTENT}}` marker?

### Documents are empty or have "No tasks found"
- **Cause:** The Prep Run record exists but has no linked Prep Tasks or Ingredient Requirements
- **Fix:** Check that GeneratePrepRun completed successfully. The Prep Run record should have values in its "Prep Tasks" and "Ingredient Requirements" linked record fields.

### LockService timeout
- **Cause:** Another export is already running (the script uses LockService to prevent concurrent execution)
- **Fix:** Wait 30 seconds and try again. If it persists, check the GAS Executions log for hung processes.

---

## How to Check If It Worked

1. **Check Slack:** All recipients should receive a message with document links
2. **Check Google Drive:** A new folder named "Prep Run YYYY-MM-DD" should appear in the output folder
3. **Check the Prep Runs table:** The "Link to Prep Guides" field should contain the folder URL
4. **Check GAS Executions:** In the GAS editor, go to Executions (left sidebar) to see the run log

---

## How to Edit This Script

### Option 1: GAS Editor (browser)
1. Open `https://script.google.com/d/1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM/edit`
2. Find GoogleDocsPrepSystem.gs in the file list
3. Edit directly in the browser
4. Changes are saved immediately

### Option 2: clasp (command line)
1. Edit the file locally: `Sakura House/scripts/GoogleDocsPrepSystem.gs`
2. Push to GAS: `cd "Sakura House/scripts" && clasp push --force`
3. This overwrites the entire GAS project with the local files

**Important:** If you edit in the GAS browser editor AND locally, the versions can diverge. Always pull before pushing: `clasp pull` downloads the current GAS code locally.

---

## Key Functions Reference

| Function | Purpose |
|----------|---------|
| `doPost()` | Webhook endpoint -- receives export requests |
| `doGet()` | Web app router -- serves Feedback Form or Recipe Scaler |
| `exportLatestPrepRunToDocs()` | Main export function (LIVE mode) |
| `exportLatestPrepRunToDocs_TEST()` | Test mode -- all Slack to test channel |
| `createOrderingDoc_()` | Generates an ordering doc (template-first, with fallback) |
| `createBatchingDoc_()` | Generates the batching doc |
| `createIngredientPrepDoc_()` | Generates the ingredient prep doc |
| `buildOrdering_()` | Splits requirements into Gooch/Sabs/needsRouting/negligible |
| `postPrepRunToSlack_()` | Sends Slack notifications to all recipients |
| `formatQtyWithBuffer_()` | Formats quantities as "100ml (1.5x = 150ml)" |
