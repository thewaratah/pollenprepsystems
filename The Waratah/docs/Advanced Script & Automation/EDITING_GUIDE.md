# How to Edit Scripts -- Editing Guide

**Last Updated:** 2026-03-22
**Audience:** Operations Manager maintaining The Waratah PREP system

---

## Two Different Edit Workflows

The Waratah has two types of scripts in two different environments. The editing process is completely different for each.

---

## Editing Airtable Automation Scripts (Waratah_*.gs)

These scripts run inside Airtable. They are NOT deployed to Google Apps Script.

### How to Find Them

1. Open The Waratah Airtable base
2. Click **Automations** in the top navigation bar
3. Find the automation by name (e.g., "Init Stock Count", "Generate Prep Run")
4. Click on the automation to expand it
5. Find the "Run a script" action step
6. Click on the script step to open the code editor

### How to Edit

1. Open the script in the Airtable code editor (as described above)
2. Make your changes directly in the editor
3. Click **Save** (or the checkmark)
4. To test, click the **Run** button (make sure `dryRun = true` in the input config first)

### How to Paste Updated Code

If you have updated code from the local files (e.g., after a developer made changes):

1. Open the `.gs` file on disk (in `The Waratah/scripts/`)
2. Select all the code (Ctrl+A / Cmd+A)
3. Copy it (Ctrl+C / Cmd+C)
4. In the Airtable automation code editor, select all existing code
5. Paste the new code (Ctrl+V / Cmd+V)
6. Save

### Testing Airtable Scripts

All Airtable scripts support `dryRun = true` as an input:

1. In the automation, click the script step
2. In the "Input" configuration, set `dryRun` to `true`
3. Click **Run** (or "Test step")
4. Check the console output for what would happen
5. When satisfied, set `dryRun` to `false` and run for real

### Checking Logs

Airtable automation logs are visible in:
- The automation's run history (click the automation, then "Run History")
- The **Audit Log** table in Airtable (all scripts write to this table)

---

## Editing Google Apps Script Files

These scripts run in Google's cloud. They can be edited either in the GAS web editor or locally with clasp.

### Option 1: GAS Web Editor (Quick Edits)

1. Open the GAS editor:
   - Run `clasp open` from `The Waratah/scripts/` directory, OR
   - Visit `https://script.google.com/d/10Ox7eE9-ReUCIpGR75fVB8lOpd2aBq6N2rsy87NIEK5cKuWNDmzHFoV8/edit`
2. Find the file in the left sidebar (e.g., `GoogleDocsPrepSystem.gs`)
3. Make your changes
4. Save (Ctrl+S / Cmd+S)
5. Changes take effect immediately for triggers; web app changes may need a new deployment

### Option 2: Local Edit + clasp push (Recommended for Larger Changes)

1. Edit the file locally at `The Waratah/scripts/GoogleDocsPrepSystem.gs`
2. Verify `.claspignore` before pushing:
   ```bash
   cd "The Waratah/scripts"
   clasp status
   # VERIFY: No Waratah_*.gs files appear in the output
   ```
3. Push to GAS:
   ```bash
   clasp push --force
   ```
4. The `--force` flag ensures the local `appsscript.json` (with `"dependencies": {}`) overwrites the remote manifest

### Checking GAS Logs

1. Open the GAS editor
2. Click **Executions** in the left sidebar
3. View logs for each function execution (includes `Logger.log()` output)
4. Or click the **Logs** icon during execution to see real-time output

---

## The .claspignore Rule

This is a **P0 (production-breaking)** rule. If violated, the entire GAS project will fail with duplicate function errors.

### What It Is

The `.claspignore` file in `The Waratah/scripts/` tells clasp which files to exclude from `clasp push`. It MUST exclude all `Waratah_*.gs` files.

### Why

Each Airtable script has functions with identical names:
- `main()`
- `formatSydneyTimestamp_()`
- `safeField_()`
- `batchCreate_()`
- etc.

GAS cannot have two files with the same function name. If these scripts are uploaded, every function call becomes ambiguous and the project crashes.

### How to Verify

Always run `clasp status` before pushing:

```bash
cd "The Waratah/scripts"
clasp status
```

The output should show ONLY:
- `GoogleDocsPrepSystem.gs`
- `FeedbackForm.gs`
- `FeedbackFormUI.html`
- `RecipeScaler.gs`
- `RecipeScalerUI.html`
- `appsscript.json`

If ANY `Waratah_*.gs` file appears: **STOP. Do not push.** Fix the `.claspignore` file first.

### Current .claspignore Contents

```
Waratah_ClearWeeklyCount.gs
Waratah_FinaliseCount.gs
Waratah_GeneratePrepRun.gs
Waratah_GeneratePrepSheet_TimeBasedPolling.gs
Waratah_InitStockCount.gs
Waratah_CompleteStockCount.gs
Waratah_ValidateStockCount.gs
Waratah_GenerateStockOrders.gs
Waratah_ExportOrderingDoc.gs
Debug.gs
*.py
*.sql
*.sh
setup/**
.clasp.json
.claspignore
```

If you add a new `Waratah_*.gs` script, you MUST add it to this file.

---

## Script Properties -- Full Reference

Script Properties are set in: **GAS Editor --> Project Settings (gear icon) --> Script Properties**

| Property | Value/Format | Used By |
|----------|-------------|---------|
| `AIRTABLE_BASE_ID` | `appfcy14ZikhKZnRS` | All GAS scripts |
| `AIRTABLE_PAT` | Personal Access Token (starts with `pat...`) | All GAS scripts |
| `DOCS_FOLDER_ID` | Google Drive folder ID | GoogleDocsPrepSystem.gs |
| `SLACK_WEBHOOK_PREP` | Slack webhook URL | Monday AM prep doc notifications |
| `SLACK_WEBHOOK_WARATAH_TEST` | Slack webhook URL | Ordering doc + test notifications |
| `SLACK_WEBHOOK_EV_TEST` | Slack webhook URL | Dev fallback for feedback + ordering |
| `MANUAL_TRIGGER_SECRET` | Random string | doPost authentication |
| `RECIPE_SYNC_SECRET` | Random string | Recipe sync API calls |
| `WARATAH_TEMPLATE_BATCHING_ID` | Google Doc ID | Batching Run Sheet template |
| `WARATAH_TEMPLATE_INGREDIENT_PREP_ID` | Google Doc ID | Ingredient Prep List template |
| `WARATAH_TEMPLATE_ORDERING_ID` | Google Doc ID | Combined Ordering template |
| `FEEDBACK_FORM_URL` | Deployed web app URL | Feedback Form access |
| `RECIPE_SCALER_URL` | Deployed web app URL | Recipe Scaler access |

---

## Common Mistakes to Avoid

### 1. Using `clear()` instead of `clearContent()`
In GAS code that manipulates Google Sheets:
- `clear()` destroys cell formatting, conditional formatting, AND data validations
- `clearContent()` only removes the data, preserving all formatting
- **Always use `clearContent()`**

### 2. Wrong Airtable Base ID
The Waratah base ID is `appfcy14ZikhKZnRS`. Sakura House is `appNsFRhuU47e9qlR`. If you see Sakura data appearing, check the `AIRTABLE_BASE_ID` Script Property.

### 3. Wrong Staff Names
The Waratah ordering staff are **Andie** and **Blade** (and recently Evan as sole operator for combined ordering). Sakura House uses Gooch and Sabs. If you see Gooch or Sabs in Waratah code or docs, something is cross-contaminated.

### 4. Using `Recipe Name` Instead of `Item Name`
The Waratah Recipes table uses `Item Name` (a linked record to the Items table) to identify what a recipe produces. There is NO `Recipe Name` text field. Never add `fields['Recipe Name']` to Waratah code. See the RecipeScaler.md explainer for the correct resolution pattern.

### 5. Forgetting to Update .claspignore for New Scripts
If you add a new `Waratah_*.gs` Airtable script, you MUST add it to `.claspignore`. If you forget, the next `clasp push` will upload it to GAS and break the project.

### 6. Hardcoding Credentials
API keys, webhook URLs, base IDs, and secrets must NEVER appear in code. Always read them from Script Properties:
```javascript
const pat = PropertiesService.getScriptProperties().getProperty('AIRTABLE_PAT');
```

---

## Rollback Procedures

### Rolling Back an Airtable Script

1. Open the automation in Airtable
2. Open the script action
3. Find the previous version of the code:
   - Check the local file in `The Waratah/scripts/` (use git history if available)
   - Check the Drive backup folder: `https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp`
4. Paste the previous code and save

### Rolling Back a GAS Script

**Option 1: Git (if changes were committed)**
```bash
cd "The Waratah/scripts"
git log --oneline GoogleDocsPrepSystem.gs    # find the commit to revert to
git checkout <commit-hash> -- GoogleDocsPrepSystem.gs
clasp push --force
```

**Option 2: GAS Version History**
1. Open the GAS editor
2. File --> Version history
3. Find the previous version and restore it

**Option 3: Drive Backup**
1. Open the Drive backup folder
2. Download the `.txt` version of the file
3. Rename to `.gs` and replace the local file
4. `clasp push --force`

---

## sync-airtable-scripts-to-drive.sh

This shell script copies all Airtable scripts and GoogleDocsPrepSystem.gs to a Google Drive folder as `.txt` files, serving as a backup.

### When to Run It

Run this script after ANY change to:
- Any `Waratah_*.gs` file
- `GoogleDocsPrepSystem.gs`

### How to Run It

```bash
cd "The Waratah/scripts"
bash sync-airtable-scripts-to-drive.sh
```

### What It Does

1. Authenticates with Google Drive using the clasp OAuth token
2. For each script file:
   - Checks if a `.txt` version already exists in the Drive backup folder
   - If yes: updates the existing file
   - If no: creates a new file
3. Generates a README.txt with the sync timestamp

### Drive Backup Folder

URL: `https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp`

This folder contains `.txt` copies of every script, useful for:
- Quick reference without opening Airtable or GAS
- Rollback if a script is accidentally corrupted
- Sharing with developers who do not have Airtable access

---

## Testing Checklist Before Deploying Changes

1. If editing an Airtable script:
   - [ ] Test with `dryRun = true` first
   - [ ] Check the Audit Log for any errors
   - [ ] Verify the expected output in the console
   - [ ] Run live with `dryRun = false`
   - [ ] Run `sync-airtable-scripts-to-drive.sh`

2. If editing a GAS script:
   - [ ] Run `clasp status` and verify no `Waratah_*.gs` files are listed
   - [ ] Push with `clasp push --force`
   - [ ] Test the function in the GAS editor (Run button)
   - [ ] Check GAS Executions for errors
   - [ ] Run `sync-airtable-scripts-to-drive.sh`

3. If adding a new Airtable script:
   - [ ] Name it with the `Waratah_` prefix
   - [ ] Add it to `.claspignore`
   - [ ] Add it to the `AIRTABLE_SCRIPTS` array in `sync-airtable-scripts-to-drive.sh`
   - [ ] Verify with `clasp status`
