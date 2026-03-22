# How to Edit Scripts -- Practical Guide

**Last Updated:** 2026-03-22
**Audience:** Operations Manager maintaining the system

---

## Two Editing Environments

The Sakura House PREP system has scripts in two separate places. Editing in the wrong place will have no effect (or worse, create divergence).

| Script Type | Where to Edit | How to Access |
|-------------|---------------|---------------|
| Airtable automations | Airtable automation editor | Airtable base > Automations tab |
| GAS scripts | Google Apps Script editor (or clasp) | Browser or command line |

### Rule of Thumb
- **If the script uses `base.getTable()` or `table.selectRecordsAsync()`** -- it is an Airtable automation. Edit in Airtable.
- **If the script uses `DriveApp`, `DocumentApp`, `UrlFetchApp`, `PropertiesService`** -- it is a GAS script. Edit in the GAS editor.

---

## Editing Airtable Automation Scripts

### Finding the Automation

1. Open the Airtable base: `https://airtable.com/appNsFRhuU47e9qlR`
2. Click the **Automations** tab in the top navigation
3. You will see a list of all automations. Each one has:
   - A **name** (e.g., "Friday AM: Clear Prep Data")
   - A **trigger** (scheduled, button click, etc.)
   - One or more **actions** (the "Run script" action contains the code)

### Opening the Code Editor

1. Click on the automation to expand it
2. You will see the trigger step and the action steps
3. Click on the **"Run script"** action step
4. The code editor opens in a panel. This is where the actual script lives.

### Making Changes

1. **Before editing:** Copy the entire existing code to a text file as a backup
2. Make your changes in the editor
3. Click **"Test"** to run the script once and see the output
4. If the test passes, the automation will use your updated code on its next trigger

### Testing

- Airtable provides a "Test" button directly in the automation editor
- The test output shows all `console.log()` messages from the script
- If the script has a `dryRun` input, set it to `true` in the Input variables for a safe test

### Viewing Run History

1. Click on the automation name
2. Click "Run history" or the history icon
3. You can see every past execution with:
   - Timestamp
   - Success/failure status
   - Console output
   - Error messages (if any)

### Input Variables

Each automation script can accept input variables. To set them:
1. In the automation action step, look for "Input variables" or "Configuration"
2. Add a variable name (e.g., `dryRun`) and set its value (e.g., `true`)
3. The script reads these via `input.config()`

---

## Editing GAS Scripts

### Option 1: Browser Editor

1. Open the GAS editor: `https://script.google.com/d/1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM/edit`
2. The file list appears on the left
3. Click on a file to open it
4. Edit directly in the browser
5. Changes are saved automatically (Ctrl+S to save explicitly)

### Option 2: clasp (Command Line)

If you have the `clasp` tool installed:

```bash
# Navigate to the scripts directory
cd "Sakura House/scripts"

# Pull the latest code from GAS (do this first to avoid overwriting remote changes)
clasp pull

# Edit files locally with any text editor

# Push your changes to GAS
clasp push --force

# Open the GAS editor in your browser
clasp open
```

**Important:** `clasp push --force` overwrites the ENTIRE GAS project with your local files. Always `clasp pull` first if someone else may have edited in the browser.

### Testing GAS Scripts

1. In the GAS editor, select the function you want to test from the function dropdown
2. Click **Run**
3. Check the **Execution log** at the bottom for output
4. For more detailed logs, go to **Executions** in the left sidebar

### Viewing Execution History

1. In the GAS editor, click **Executions** in the left sidebar
2. You can see every past execution with:
   - Timestamp
   - Function name
   - Duration
   - Status (Completed, Failed, Timed out)
   - Click on any execution to see its full log

---

## Script Properties -- Where They Are and What They Control

Script Properties are key-value settings stored in the GAS project. They hold sensitive configuration that should never be hardcoded.

### Where to Find Them

1. Open the GAS editor
2. Click the **gear icon** (Project Settings) in the left sidebar
3. Scroll down to **Script Properties**
4. You can view, add, edit, or delete properties here

### Full Property List

| Property | What It Controls | Example Value |
|----------|-----------------|---------------|
| `AIRTABLE_BASE_ID` | Which Airtable base to connect to | `appNsFRhuU47e9qlR` |
| `AIRTABLE_PAT` | Authentication token for Airtable API | `patXXXX...` (starts with "pat") |
| `DOCS_FOLDER_ID` | Google Drive folder where docs are saved | `1abc...` (folder ID from URL) |
| `SLACK_WEBHOOK_KALISHA` | Kalisha's Slack channel webhook | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_EVAN` | Evan's Slack channel webhook | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_GOOCH` | Gooch's Slack channel webhook | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_SABS` | Sabs' Slack channel webhook | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_PREP` | Prep team channel webhook | `https://hooks.slack.com/services/...` |
| `SLACK_WEBHOOK_EV_TEST` | Test channel (used in TEST mode + feedback) | `https://hooks.slack.com/services/...` |
| `MANUAL_TRIGGER_SECRET` | Password for the webhook endpoint | Any string (keep it secret) |
| `TEMPLATE_ORDERING_ID` | Google Docs template for ordering lists | Google Doc file ID |
| `TEMPLATE_BATCHING_ID` | Google Docs template for batching list | Google Doc file ID |
| `TEMPLATE_INGREDIENT_PREP_ID` | Google Docs template for ingredient prep | Google Doc file ID |
| `FEEDBACK_FORM_URL` | URL of the deployed web app | `https://script.google.com/macros/s/.../exec` |
| `RECIPE_SCALER_URL` | Same URL as FEEDBACK_FORM_URL (unified deployment) | Same as above |

### How to Change a Script Property

1. Go to GAS editor > Project Settings > Script Properties
2. Find the property you want to change
3. Click the edit (pencil) icon
4. Enter the new value
5. Click Save

### How to Add a New Script Property

1. Go to GAS editor > Project Settings > Script Properties
2. Click "Add script property"
3. Enter the key name and value
4. Click Save

---

## Common Mistakes to Avoid

### 1. Using `clear()` instead of `clearContent()`

**This is the number one production-breaking mistake.**

- `clear()` destroys ALL cell formatting, conditional formatting, and data validations in Google Sheets
- `clearContent()` removes only the data, preserving formatting

**Rule:** Always use `clearContent()`. If you see `clear()` in any code, it is almost certainly a bug.

### 2. Hardcoding Base IDs, PATs, or Webhook URLs

Never put credentials directly in the code:

```javascript
// WRONG - will break if the token changes
const pat = "patABCDEF123456";

// CORRECT - reads from Script Properties
const pat = PropertiesService.getScriptProperties().getProperty('AIRTABLE_PAT');
```

### 3. Wrong Staff Names

Sakura House ordering staff are **Gooch** and **Sabs**. If you see "Andie" or "Blade" in the code, that is Waratah code that has been accidentally copied.

### 4. Wrong Airtable Base ID

Sakura House base ID is `appNsFRhuU47e9qlR`. The Waratah base is `appfcy14ZikhKZnRS`. Mixing them up connects to the wrong database.

### 5. Wrong Recipe Name Field

Sakura House uses `"Recipe Name"` (a plain text field). If you see `"Item Name"` used for recipe lookup (which is the Waratah pattern), it will not work.

### 6. Missing Script Properties

If you add a new feature that needs a Script Property, you must:
1. Add the property to the GAS project (Project Settings > Script Properties)
2. Document it in this guide
3. Use `PropertiesService.getScriptProperties().getProperty('KEY_NAME')` to read it

---

## How to Do a Dry Run

### Airtable Automations

Most Airtable scripts support a `dryRun` input:

1. Open the automation
2. Go to the "Run script" action
3. Add or set the `dryRun` input variable to `true`
4. Click "Test"
5. The script will report what it would do without making changes
6. **Remember to set `dryRun` back to `false`** (or remove it) when done testing

### GAS Scripts

For GoogleDocsPrepSystem, use the TEST mode:
1. Open the GAS editor
2. Select `exportLatestPrepRunToDocs_TEST` from the function dropdown
3. Click Run
4. This generates real documents but sends all Slack notifications to the test channel only

---

## Rollback: Undoing a Bad Change

### GAS Version History

GAS keeps a version history:
1. In the GAS editor, go to **File > Version history**
2. You can see all past versions with timestamps
3. Click on a previous version to view it
4. You can restore the entire project to a previous version

### Airtable Automation History

Airtable automations do not have code version history in the same way. This is why it is critical to **copy the existing code to a backup file before making changes**.

If you made a bad change and do not have a backup:
1. Check if the code is in the local git repository: `Sakura House/scripts/ClearWeeklyCount.gs` (etc.)
2. If yes, use that version
3. If the local file is also wrong, check git history: `git log --oneline -- "Sakura House/scripts/ClearWeeklyCount.gs"`

### Emergency: Disable an Automation

If an automation is causing problems and you need to stop it immediately:
1. Open the Airtable base
2. Go to Automations
3. Find the problematic automation
4. Toggle it **OFF** (there is an on/off switch)
5. This prevents it from running on its schedule or when a button is clicked

---

## Checking Logs

### Airtable Automation Logs

1. Go to Automations tab
2. Click the automation
3. Click "Run history"
4. Each entry shows the console output and any errors

### GAS Execution Logs

1. Open the GAS editor
2. Click **Executions** in the left sidebar
3. Each entry shows the function, duration, status, and full log
4. Click on an entry to expand the details

### Audit Log Table

Many scripts write to the "Audit Log" table in Airtable. Check this table for:
- Script Name (which script ran)
- Status (SUCCESS, WARNING, ERROR)
- Message (summary of what happened)
- Details (full diagnostic info)
- Execution Time
- Config Used (what settings were active)
