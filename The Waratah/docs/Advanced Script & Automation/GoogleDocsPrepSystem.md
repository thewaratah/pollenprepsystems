# GoogleDocsPrepSystem.gs -- Document Generator + Slack

**Script:** `GoogleDocsPrepSystem.gs`
**Environment:** Google Apps Script (deployed via clasp)
**Script ID:** `10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8`

---

## What It Does

This is the main GAS script. It reads prep and ordering data from Airtable, generates formatted Google Docs, and sends Slack notifications. It handles three types of document:

1. **Ingredient Prep List** -- Sub-recipe tasks grouped by their parent batch, with ingredient lists and quantities
2. **Batching Run Sheet** -- Batch tasks with ingredient bullets and recipe method steps
3. **Combined Ordering Run Sheet** -- Bar stock + prep ingredients grouped by supplier, with final order quantities

It also serves as the web app router for the Feedback Form and Recipe Scaler.

---

## How It Works

### Monday AM Export (Automated -- 2 Prep Docs)

GAS has a time-driven trigger that runs `processExportRequests()` every 1-2 minutes. This function polls the `Prep Runs` table in Airtable for records where `Export Request State = "REQUESTED"`.

When found:
1. Fetches the Prep Run's linked Prep Tasks and Ingredient Requirements from Airtable
2. Fetches Items, Recipes, Recipe Lines, Suppliers, Par Levels, and Weekly Counts data
3. Generates the **Ingredient Prep List** Google Doc
4. Generates the **Batching Run Sheet** Google Doc
5. Sends Slack notifications with document links
6. Sets `Export Request State = "COMPLETED"` in Airtable

### Ordering Export Polling (After Stock Count -- 1 Ordering Doc)

A separate function `processOrderingExportRequests()` polls the `Count Sessions` table for records where `Ordering Export State = "REQUESTED"`.

When found:
1. Calls `exportCombinedOrderingDoc_()` which:
   - Finds the latest "Orders Generated" Count Session
   - Fetches all Stock Orders linked to that session
   - Fetches the latest Prep Run's Ingredient Requirements for prep-only items
   - Groups everything by supplier
   - Generates the **Combined Ordering Run Sheet** Google Doc
2. Sends Slack notification to `SLACK_WEBHOOK_WARATAH_TEST` (Evan's test channel)
3. Sets `Ordering Export State = "COMPLETED"` (or "ERROR" on failure)

### Manual Trigger (doPost webhook)

The script exposes a `doPost()` endpoint for manual triggers. Send a POST request with:
```json
{
  "secret": "<MANUAL_TRIGGER_SECRET value>",
  "action": "ordering"
}
```
This generates the ordering doc immediately without waiting for polling.

---

## The Hybrid Template Engine (v4.2)

Documents use a hybrid approach:
- **Templates** provide branding: header logos, styling, page layout
- **Code** provides content: all dynamic data (item lists, quantities, grouped sections) is inserted programmatically

Templates contain placeholders:
- `{{DATE}}` -- replaced with the current date
- `{{RUN_LABEL}}` -- replaced with the Prep Run label
- `{{STAFF_NAME}}` -- replaced with the staff name
- `{{CONTENT}}` -- marker where all dynamic content is inserted

If a template is missing or the template ID is not configured, the script falls back to pure programmatic document generation (no branding, just content).

---

## Web App Router (doGet)

The script also serves two web apps through a unified `doGet()` router:

| URL Parameter | Destination |
|---------------|-------------|
| `?page=scaler` | Recipe Scaler (`doGetRecipeScaler()` in RecipeScaler.gs) |
| `?page=feedback` (or no parameter) | Feedback Form (`doGetFeedback()` in FeedbackForm.gs) |

The web app URL is set as `FEEDBACK_FORM_URL` and `RECIPE_SCALER_URL` in Script Properties.

---

## Script Properties Required

| Property | Used For |
|----------|---------|
| `AIRTABLE_BASE_ID` | Airtable API calls (`appfcy14ZikhKZnRS`) |
| `AIRTABLE_PAT` | Airtable authentication |
| `DOCS_FOLDER_ID` | Google Drive folder for generated docs |
| `SLACK_WEBHOOK_PREP` | Monday AM prep doc Slack notifications |
| `SLACK_WEBHOOK_WARATAH_TEST` | Ordering doc and test Slack notifications |
| `MANUAL_TRIGGER_SECRET` | Authenticates doPost webhook calls |
| `WARATAH_TEMPLATE_BATCHING_ID` | Google Doc ID for Batching Run Sheet template |
| `WARATAH_TEMPLATE_INGREDIENT_PREP_ID` | Google Doc ID for Ingredient Prep List template |
| `WARATAH_TEMPLATE_ORDERING_ID` | Google Doc ID for Combined Ordering template |
| `FEEDBACK_FORM_URL` | URL for the Feedback Form web app |
| `RECIPE_SCALER_URL` | URL for the Recipe Scaler web app |

---

## GAS Time-Driven Triggers

Two triggers must be set up in the GAS editor (Triggers section):

| Trigger Function | Frequency | Purpose |
|-----------------|-----------|---------|
| `processExportRequests` | Every 1-2 minutes | Polls Prep Runs for REQUESTED exports |
| `processOrderingExportRequests` | Every 1-2 minutes | Polls Count Sessions for REQUESTED ordering exports |

**To set up a trigger:**
1. Open the GAS editor
2. Click the clock icon (Triggers) in the left sidebar
3. Click "+ Add Trigger"
4. Select the function name
5. Set type to "Time-driven"
6. Set interval to "Every minute" or "Every 2 minutes"

---

## How to Edit This Script

**Option 1: GAS Web Editor**
1. Open the GAS editor (use `clasp open` from terminal, or visit the script URL directly)
2. Find `GoogleDocsPrepSystem.gs` in the file list
3. Edit the code
4. Save (Ctrl+S / Cmd+S)

**Option 2: Local + clasp push**
1. Edit the file at `The Waratah/scripts/GoogleDocsPrepSystem.gs`
2. From the scripts directory, run `clasp push --force`
3. Verify with `clasp status` that no `Waratah_*.gs` files are included

After editing, run `bash sync-airtable-scripts-to-drive.sh` to update the Drive backup.

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "No Prep Run found" | No Prep Runs exist or none have linked tasks/requirements | Check the Prep Runs table in Airtable |
| Slack notification not sent | Webhook URL is invalid or missing in Script Properties | Check the `SLACK_WEBHOOK_PREP` and `SLACK_WEBHOOK_WARATAH_TEST` properties |
| Template not applied (plain doc generated) | Template ID not set in Script Properties, or template doc deleted | Set the template Google Doc IDs in Script Properties |
| "Another export is running" | Lock contention -- two triggers fired simultaneously | Wait 30 seconds and check again. The lock ensures only one export runs at a time |
| "Library with identifier X is missing" | Remote GAS project references a deleted library | Run `clasp push --force` to overwrite the remote manifest with the local one (which has `"dependencies": {}`) |
| Document has wrong data | Airtable data was changed after the export | Re-trigger the export by clearing and re-setting the Export Request State |

---

## Key Functions Reference

| Function | Purpose |
|----------|---------|
| `doGet(e)` | Web app router -- serves Feedback Form or Recipe Scaler |
| `doPost(e)` | Webhook endpoint -- manual triggers for ordering doc (returns sanitized error messages) |
| `exportLatestPrepRunToDocs()` | Generates Ingredient Prep List + Batching Run Sheet |
| `exportCombinedOrderingDoc_()` | Generates Combined Ordering Run Sheet |
| `processExportRequests()` | Polls Prep Runs for REQUESTED state (prep docs) |
| `processOrderingExportRequests()` | Polls Count Sessions for REQUESTED state, patches to IN_PROGRESS before processing (ordering doc) |
| `exportLatestPrepRunToDocs_TEST()` | Test version -- sends to test Slack channel |
| `exportCombinedOrderingDoc_TEST()` | Test version -- sends to test Slack channel |
