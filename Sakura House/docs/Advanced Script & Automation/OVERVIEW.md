# Sakura House PREP System -- Architecture Overview

**Last Updated:** 2026-03-22
**Audience:** Operations Manager maintaining the system

---

## What This System Does

The Sakura House PREP system automates the weekly cycle of stocktaking, ordering, and prep task generation. It connects three platforms:

1. **Airtable** -- the database where all items, recipes, stock counts, and prep data live
2. **Google Apps Script (GAS)** -- a cloud scripting platform that generates Google Docs and sends Slack messages
3. **Google Docs + Slack** -- the output that staff actually see and work from

The system replaces manual spreadsheet work. Instead of someone calculating shortfalls, writing ordering lists, and assembling prep sheets by hand each week, automation scripts do it in seconds.

---

## How the Three Systems Connect

```
AIRTABLE (Database + Automations)           GOOGLE APPS SCRIPT (Cloud)              STAFF

Items, Recipes, Par Levels,          --->   GoogleDocsPrepSystem.gs          --->    Google Docs
Weekly Counts, Prep Runs                    (generates 4 documents)                 (ordering lists,
                                                                                    batching lists,
Airtable Automations:                       FeedbackForm.gs                 --->    prep lists)
  ClearPrepData.gs                          (staff feedback collection)
  ClearWeeklyCount.gs                                                       --->    Slack Messages
  FinaliseCount.gs                          RecipeScaler.gs                         (doc links to
  GeneratePrepRun.gs                        (recipe scaling tool)                    Gooch, Sabs,
  GeneratePrepSheet.gs                                                               prep team)
         |                                          ^
         |                                          |
         +---- webhook / polling trigger -----------+
```

**The flow in plain English:**

1. Airtable automation scripts run inside Airtable itself (triggered by buttons in the Interface)
2. When the manager clicks "Export Prep Sheet", GeneratePrepSheet.gs marks the record as "REQUESTED" in Airtable
3. GoogleDocsPrepSystem.gs (running in Google Apps Script) receives a webhook call
4. It reads the prep data from Airtable via API, generates 4 Google Docs, and sends Slack notifications

---

## Where Each Script Runs

This is the most important distinction to understand. There are two completely separate execution environments:

### Airtable Automation Scripts (run inside Airtable)

These scripts live in Airtable automations. You edit them directly in the Airtable automation editor. They use Airtable's scripting API (`base.getTable()`, `table.selectRecordsAsync()`, etc.).

| Script | Purpose |
|--------|---------|
| `ClearPrepData.gs` | Friday AM: delete old Prep Tasks + Ingredient Requirements |
| `ClearWeeklyCount.gs` | Saturday AM: reset Weekly Counts, create placeholders |
| `FinaliseCount.gs` | Saturday shift: validate and lock the stocktake |
| `GeneratePrepRun.gs` | Saturday shift: calculate shortfalls, generate prep tasks |
| `GeneratePrepSheet.gs` | Saturday shift: mark Prep Run for export to Google Docs |

### Google Apps Script (GAS) Scripts (run in the cloud)

These scripts live in a Google Apps Script project. You edit them either in the GAS online editor or by using the `clasp` command-line tool. They use Google services (`DriveApp`, `DocumentApp`, `UrlFetchApp`, etc.).

| Script | Purpose |
|--------|---------|
| `GoogleDocsPrepSystem.gs` | Generate 4 Google Docs + send Slack notifications |
| `FeedbackForm.gs` | Staff feedback collection web app |
| `RecipeScaler.gs` | Recipe scaling tool web app |

**The local `.gs` files on disk are backups.** The actual running code lives in Airtable (for automations) or in the GAS cloud project (for GAS scripts).

---

## The Weekly Cycle End-to-End

```
FRIDAY 8:00 AM              SATURDAY 8:00 AM           SATURDAY SHIFT (3:30 PM - 3:00 AM)

ClearPrepData               ClearWeeklyCount            1. Staff count stock in Airtable
(scheduled automation)      (scheduled automation)         Interface
- Deletes all old           - Deletes all old
  Prep Tasks                  Weekly Counts             2. Manager clicks "Finalise Count"
- Deletes all old           - Queries Items table          -> FinaliseCount runs
  Ingredient Requirements   - Creates placeholder          -> Validates all items counted
                              records with                  -> Sets Confirmed = true
                              Stock Count = 0
                                                        3. Manager clicks "Generate Prep Run"
                                                           -> GeneratePrepRun runs
                                                           -> Calculates shortfalls
                                                           -> Creates Prep Tasks
                                                           -> Creates Ingredient Requirements

                                                        4. Manager clicks "Export Prep Sheet"
                                                           -> GeneratePrepSheet runs
                                                           -> Marks run as REQUESTED
                                                           -> GAS picks up request
                                                           -> GoogleDocsPrepSystem generates 4 docs
                                                           -> Slack messages sent

                                                        5. Ordering done during shift
                                                           Gooch + Sabs use their ordering docs

SUNDAY - WEDNESDAY
- Orders arrive
- Prep work done using Batching List + Ingredient Prep List
```

---

## How to Access Each System

### Airtable

- **Base URL:** `https://airtable.com/appNsFRhuU47e9qlR`
- **Interfaces:** Staff and managers use Interfaces (dashboard views with buttons). They never need to open raw tables.
- **Automations:** Go to the Automations tab in the Airtable base to find the scripts. Each automation has a trigger (button click or schedule) and an action (run script).
- **Base ID:** `appNsFRhuU47e9qlR` (you will see this in API URLs and script configurations)

### Google Apps Script (GAS)

- **Editor URL:** Open via the command `clasp open` from the `Sakura House/scripts/` directory, or bookmark the URL once you have it
- **Script ID:** `1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM`
- **Direct URL:** `https://script.google.com/d/1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM/edit`
- **Logs:** In the GAS editor, go to Executions (left sidebar) to see recent runs and their logs

### Google Drive

- Generated docs are stored in a folder specified by the `DOCS_FOLDER_ID` Script Property
- Each prep run creates a dated subfolder (e.g., "Prep Run 2026-03-22")
- Docs are shared via link (anyone with the link can view)

### Slack

- Notifications go to individual channels for Gooch, Sabs, Kalisha, Evan, and the Prep team channel
- Each Slack channel has a webhook URL stored as a Script Property in GAS
- In TEST mode, all notifications go to a single test channel instead

---

## What Are Script Properties?

Script Properties are key-value settings stored securely inside the Google Apps Script project. They hold sensitive information that should never be written directly into code:

- API keys (the Airtable Personal Access Token)
- Webhook URLs (Slack notification endpoints)
- Google Drive folder IDs (where to save generated docs)
- Template document IDs (for branded doc templates)

**Where to find them:** In the GAS editor, go to Project Settings (gear icon in left sidebar), then scroll down to Script Properties.

**Why they matter:** If a Script Property is missing or wrong, the script will fail. The error message will usually tell you which property is missing (e.g., "Missing Script Property: AIRTABLE_PAT").

See the full list of required Script Properties in the [EDITING_GUIDE.md](EDITING_GUIDE.md).

---

## Airtable Interfaces vs Raw Tables

Staff and managers interact with the PREP system through **Airtable Interfaces** -- these are custom dashboard views with buttons, filtered lists, and forms. They are the "front end" of the system.

**What Interfaces provide:**
- A "Clear Weekly Count" button that triggers the ClearWeeklyCount automation
- Stock count entry forms
- A "Finalise Count" button
- A "Generate Prep Run" button
- A "Export Prep Sheet" button
- Views of current prep tasks and ordering requirements

**Raw tables** are the underlying data. Admins may need to access them to:
- Add new items or recipes
- Change supplier assignments
- Fix data issues
- Add or change par levels

Most day-to-day operations happen entirely through Interfaces. You only need raw table access for configuration changes or troubleshooting.

---

## Key Airtable Tables

| Table | Purpose |
|-------|---------|
| Items | All ingredients, batches, sub-recipes, garnishes -- the master item list |
| Recipes | What recipe produces which item, plus method and yield |
| Recipe Lines | Individual ingredients within each recipe (linked to Items and Recipes) |
| Par Levels | Target stock levels for each item |
| Weekly Counts | Current stocktake data (reset each week) |
| Prep Runs | One record per weekly prep cycle |
| Prep Tasks | Individual tasks generated by GeneratePrepRun (linked to a Prep Run) |
| Ingredient Requirements | Calculated ingredient needs (linked to a Prep Run) |
| Supplier | Supplier names, emails, and ordering staff assignments |
| Audit Log | Automatic logs of every script execution |
| Feedback | Staff feedback submissions |

---

## Ordering Staff

- **Gooch** -- responsible for a set of suppliers. Gets a personalised ordering doc.
- **Sabs** -- responsible for a different set of suppliers. Gets a personalised ordering doc.

Which staff member is responsible for which supplier is set in the Supplier table in Airtable (the "Ordering Staff" field). The system reads this field to split ordering requirements into two separate documents.

---

## Document Quick Reference

Each prep run export creates 4 Google Docs:

| Document | Who It Is For | What It Contains |
|----------|---------------|------------------|
| Gooch Ordering List | Gooch | Items to order, grouped by supplier, with quantities |
| Sabs Ordering List | Sabs | Items to order, grouped by supplier, with quantities |
| Batching List | Prep team | Batch recipes to make, with ingredients and methods |
| Ingredient Prep List | Prep team | Sub-recipe prep tasks, grouped under their parent batch |

All quantities show a 1.5x buffer format: `100ml (1.5x = 150ml)`. The base quantity is what the calculation determined. The buffered quantity is a safety margin. Staff should use their judgement on which to follow.

---

## Next Steps

- **To understand a specific script:** Read its individual explainer file in this directory
- **To learn how to edit scripts:** Read [EDITING_GUIDE.md](EDITING_GUIDE.md)
- **To trace a full workflow:** Read [WORKFLOWS.md](WORKFLOWS.md)
