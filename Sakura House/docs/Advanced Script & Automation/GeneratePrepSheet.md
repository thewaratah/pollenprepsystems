# GeneratePrepSheet.gs -- Script Explainer

**Version:** 3.1
**Runs in:** Airtable Automation
**Trigger:** Interface button ("Export Prep Sheet") or automation trigger
**Last Updated:** 2026-03-22

---

## What It Does

GeneratePrepSheet is a simple but critical bridge script. It marks a Prep Run record as "REQUESTED" so that Google Apps Script knows to generate the documents.

Specifically, it:

1. Reads the Prep Run record ID from the automation trigger
2. Checks if an export is already in progress (prevents double submissions)
3. Sets the "Export Request State" field to "REQUESTED"
4. Sets the "Export Requested At" timestamp
5. Clears any previous export error

That is all it does. The actual document generation happens in GoogleDocsPrepSystem.gs (running in Google Apps Script), which picks up the REQUESTED state via a webhook call or time-based polling trigger.

---

## When and Why It Runs

- **When:** Saturday night shift, after GeneratePrepRun has finished creating tasks and requirements. The manager clicks "Export Prep Sheet" in the Airtable Interface.
- **Why:** The Google Docs exporter runs in a different system (Google Apps Script). This script signals that the data is ready for export.

**Sequence:** GeneratePrepRun --> **GeneratePrepSheet** --> GoogleDocsPrepSystem (in GAS)

---

## CONFIG Object Explained

| Setting | Value | What It Means |
|---------|-------|---------------|
| `exportRequestStateField` | `"Export Request State"` | The Single Select field on Prep Runs that tracks export status |
| `exportRequestedAtField` | `"Export Requested At"` | Timestamp of when export was requested |
| `exportLastErrorField` | `"Export Last Error"` | Text field for any error messages from the export process |
| `requestedStatus` | `"REQUESTED"` | The value to set in the Export Request State field |

---

## How the Handoff Works

```
Airtable (GeneratePrepSheet)              Google Apps Script (GoogleDocsPrepSystem)

1. Sets Export Request State      --->    2. Detects REQUESTED state
   = "REQUESTED"                         3. Reads prep data from Airtable API
                                         4. Generates 4 Google Docs
                                         5. Sends Slack notifications
                                         6. Updates Export Request State = "DONE"
```

The GAS script can detect the REQUESTED state either by:
- **Webhook:** A direct HTTP POST call to the GAS web app URL (most common in Sakura)
- **Time-based trigger:** A GAS trigger that polls Airtable every few minutes looking for REQUESTED records

---

## Guard Against Double Submissions

Before setting REQUESTED, the script checks the current Export Request State:

- If it is already "REQUESTED" or "IN_PROGRESS", the script **does not** submit again. It shows a message asking the user to wait.
- This prevents clicking the button multiple times from generating duplicate documents.

---

## Automation Inputs

| Input | Type | Required | What It Does |
|-------|------|----------|--------------|
| `recordId` | string | Yes | The Prep Run record ID to export (passed from the automation trigger) |

**Setup requirement:** The automation trigger must pass the Record ID as an input variable named `recordId`. If this is missing, the script will throw an error with setup instructions.

---

## What Could Go Wrong

### "No record ID provided"
- **Cause:** The automation is not configured to pass the Record ID
- **Fix:** In the automation trigger settings, add an input variable: `recordId` = Record ID from trigger

### "Record not found in Prep Runs table"
- **Cause:** The record was deleted between trigger and script execution
- **Fix:** This should not happen in normal use. Check the automation configuration.

### "Export already requested/in_progress"
- **Not an error** -- this is the guard working correctly. Wait for the current export to finish (check the Export Request State field on the Prep Run record).

### Export stays stuck on "REQUESTED"
- **Cause:** The GAS script is not running, or the webhook is not configured
- **Fix:** Check that:
  1. The GAS project is deployed as a web app
  2. The webhook URL is correctly configured in the Airtable automation or the GAS time-trigger is set up
  3. The GAS execution logs (Executions tab in GAS editor) show recent runs
  4. Script Properties are correctly set (especially AIRTABLE_BASE_ID and AIRTABLE_PAT)

---

## How to Check If It Worked

1. **Check the Prep Runs table:** The Export Request State should change from blank to "REQUESTED"
2. **Wait 1-5 minutes:** The GAS script will pick it up and change it to "IN_PROGRESS" then "DONE"
3. **Check "Link to Prep Guides":** Once export is complete, a folder URL will appear in this field
4. **Check Slack:** Gooch, Sabs, and the Prep team should receive notifications with doc links

---

## How to Edit This Script in Airtable

1. Open the Airtable base: `https://airtable.com/appNsFRhuU47e9qlR`
2. Go to the **Automations** tab
3. Find the automation connected to the "Export Prep Sheet" button
4. Click the "Run script" action step

This script is intentionally simple. The only things you might need to change are:
- The field names in CONFIG (if you rename fields in the Prep Runs table)
- The status values (if you change the Single Select options)

**Do not** add document generation logic to this script. That belongs in GoogleDocsPrepSystem.gs (in GAS), not here.
