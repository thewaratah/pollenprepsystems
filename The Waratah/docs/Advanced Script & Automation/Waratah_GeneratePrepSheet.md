# Waratah_GeneratePrepSheet_TimeBasedPolling.gs -- GeneratePrepSheet Explainer

**Script:** `Waratah_GeneratePrepSheet_TimeBasedPolling.gs`
**Environment:** Airtable Automation (runs inside Airtable, NOT in GAS)
**Trigger:** Scheduled automation -- Sunday 11:15pm (same time as GeneratePrepRun, or shortly after)

---

## What It Does

This script is a bridge between Airtable and Google Apps Script. It does one simple thing: finds Prep Runs that need their documents generated and marks them as `REQUESTED`. GAS then picks up these requests and creates the actual documents.

Specifically, it:

1. Queries all Prep Runs
2. Finds runs where `Export Request State` is empty, null, or "READY" (meaning they need export)
3. Filters out runs older than 14 days (date guard to prevent stale historical runs from being triggered)
4. Sets `Export Request State = "REQUESTED"` on each qualifying run
5. Sets `Export Requested At` to the current timestamp
6. Clears any previous `Export Last Error`

After this runs, the GAS time-trigger (running every 1-2 minutes) detects the REQUESTED state and generates the documents.

---

## When It Runs

- **Normal cycle:** Sunday 11:15pm, after GeneratePrepRun creates the Prep Run and its tasks
- **No inputs required** -- the script automatically finds qualifying runs

---

## The REQUESTED State Polling Mechanism

This is a "flag and poll" pattern:

```
1. Airtable script sets Export Request State = "REQUESTED" on Prep Runs table
2. GAS time-trigger polls Airtable every 1-2 minutes
3. GAS finds REQUESTED records
4. GAS generates Google Docs (Ingredient Prep List + Batching Run Sheet)
5. GAS sends Slack notifications
6. GAS sets Export Request State = "COMPLETED" (or "ERROR" if it fails)
```

This pattern exists because Airtable cannot directly call GAS functions. Instead, Airtable sets a flag and GAS polls for it.

---

## CONFIG Object Explained

| Config Key | Value | Notes |
|------------|-------|-------|
| `exportRequestStateField` | `"Export Request State"` | Single-select field on Prep Runs table |
| `exportRequestedAtField` | `"Export Requested At"` | Date field recording when the request was made |
| `exportLastErrorField` | `"Export Last Error"` | Text field for error messages from failed exports |
| `requestedStatus` | `"REQUESTED"` | The value set to trigger GAS polling |
| `readyToExportStatuses` | `[null, "", "READY"]` | States that indicate a run needs export |
| `maxAgeDays` | `14` | Only process runs with Prep Week within the last 14 days |
| `maxRecordsToProcess` | `10` | Safety limit -- process at most 10 runs per execution |

---

## Date Guard

The script only processes Prep Runs whose `Prep Week` date is within the last 14 days. This prevents old historical runs from being accidentally re-triggered if someone clears their Export Request State.

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| "No prep runs need export at this time" | All recent runs already have REQUESTED/COMPLETED state, or no runs exist within 14 days | Check the Prep Runs table for the Export Request State column |
| GAS does not pick up the request | GAS time-trigger is not set up, or is paused | Open GAS editor, go to Triggers, verify a time-driven trigger exists for `processExportRequests` |
| Export Request State stuck on REQUESTED | GAS failed silently or the trigger is not running | Check GAS execution logs (GAS editor --> Executions) for errors |
| Run is older than 14 days | The date guard filters it out | This is by design. If you need to regenerate docs for an old run, manually set its Export Request State to "REQUESTED" |

---

## How to Check If It Worked

1. Open the **Prep Runs** table
2. The latest run should show `Export Request State = "REQUESTED"`
3. `Export Requested At` should show a recent timestamp
4. Within 1-5 minutes, the state should change to "COMPLETED" (set by GAS after generating docs)
5. If the state changes to "ERROR", check the `Export Last Error` field for details

---

## Superseded Version

This script (`_TimeBasedPolling` version) supersedes the older `GeneratePrepSheet.gs` (single-record Airtable automation version). The old version required Airtable's automation infrastructure to pass a `recordId` and could not be run manually. The polling version works for both automated and manual scenarios.

---

## What Happens Next

After this script sets `Export Request State = REQUESTED`, GAS (`GoogleDocsPrepSystem.gs`) detects the request and:
1. Generates the **Ingredient Prep List** (Sub Recipe tasks grouped by Batch)
2. Generates the **Batching Run Sheet** (Batch tasks with ingredients and method)
3. Sends Slack notifications with links to the documents
4. Sets `Export Request State = COMPLETED`
