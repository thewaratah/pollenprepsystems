# FeedbackForm.gs -- Script Explainer

**Version:** 1.1
**Runs in:** Google Apps Script (GAS)
**Trigger:** Staff access via link in generated documents or direct URL
**Last Updated:** 2026-03-22

---

## What It Does

FeedbackForm is a web app that allows staff (Gooch, Sabs, prep team) to submit feedback about the generated prep documents. It handles:

1. **Displaying** a mobile-friendly feedback form
2. **Accepting** feedback submissions (staff name, type, description, item/recipe references)
3. **AI Triage** -- automatically categorising feedback and suggesting next actions
4. **Saving** feedback to an Airtable "Feedback" table
5. **Sending** a Slack notification to the admin channel

---

## How Staff Access It

### From Generated Docs
Every generated document (Ordering Lists, Batching List, Ingredient Prep List) includes a "Have feedback? Submit here" link at the top. Clicking it opens the feedback form with the prep run, document type, and staff role pre-filled.

### Direct URL
Staff can also bookmark the feedback form URL directly. The URL is the same as the main GAS web app deployment URL (without the `?page=scaler` parameter, or explicitly with `?page=feedback`).

---

## Feedback Types

Staff choose from four feedback categories:

| Type | What It Means |
|------|---------------|
| **Missing Data** | An ingredient, item, or data point is missing from the document |
| **Recipe Issue** | A recipe has wrong quantities, missing steps, or incorrect methods |
| **Suggestion** | A general improvement idea |
| **Other** | Anything that does not fit the above |

---

## AI Triage System

When feedback is submitted, the script runs a pattern-matching triage:

### For "Missing Data" feedback:
- Searches the Items table for the mentioned item name
- If found: suggests checking recipe linkages
- If not found: suggests adding it as a new item
- Category: "Data Fix" (75-85% confidence)

### For "Recipe Issue" feedback:
- If a recipe reference is provided, searches Recipe Lines for the mentioned ingredient
- If found: identifies the specific Recipe Line and its current quantity
- Category: "Recipe Update" (80-90% confidence)

### For "Suggestion" and "Other":
- Category: "General" (40-60% confidence)
- Generic suggestion to review at next planning meeting

The triage results are shown to the submitter and included in the Slack notification.

---

## Airtable Storage

Each submission creates a record in the "Feedback" table with:

| Field | Content |
|-------|---------|
| Staff Name | Who submitted it |
| Feedback Type | Missing Data / Recipe Issue / Suggestion / Other |
| Description | Free-text description |
| Staff Role | Prep Team / Ordering - Gooch / Ordering - Sabs / Manager |
| Doc Type | Which document the feedback is about |
| Prep Run | Link to the relevant Prep Run record |
| Item Reference | Link to the referenced Item (if applicable) |
| Recipe Reference | Link to the referenced Recipe (if applicable) |
| AI Category | Triage result: Data Fix / Recipe Update / General |
| AI Suggestion | What the triage recommends doing |
| AI Confidence | Confidence percentage (40-90%) |
| Status | Initially "New" |
| Slack Notified | Whether the Slack notification was sent |

---

## Slack Notification

Feedback submissions send a Block Kit message to the `SLACK_WEBHOOK_EV_TEST` channel with:
- Who submitted it and their role
- Which document and feedback type
- The full description
- AI triage category and suggestion
- Item/recipe references if provided

---

## Script Properties Required

| Property | Purpose |
|----------|---------|
| `AIRTABLE_BASE_ID` | Sakura Airtable base (`appNsFRhuU47e9qlR`) |
| `AIRTABLE_PAT` | Airtable Personal Access Token |
| `SLACK_WEBHOOK_EV_TEST` | Slack channel for feedback notifications |

---

## What Could Go Wrong

### "Airtable credentials not configured"
- **Cause:** `AIRTABLE_BASE_ID` or `AIRTABLE_PAT` Script Properties are missing
- **Fix:** Add them in GAS editor > Project Settings > Script Properties

### Feedback submitted but no Slack notification
- **Cause:** `SLACK_WEBHOOK_EV_TEST` is missing or expired
- **Impact:** Feedback is still saved to Airtable -- Slack is a notification, not a requirement
- **Fix:** Update the webhook URL in Script Properties

### Form loads but item search returns no results
- **Cause:** Airtable API connection issue, or the Items table is empty
- **Fix:** Run `debugFeedbackForm()` from the GAS editor to test the connection

### Form does not load at all
- **Cause:** The GAS web app deployment may need to be updated after code changes
- **Fix:** In GAS editor, go to Deploy > Manage deployments > edit the active deployment and click Deploy

---

## How to Check If It Worked

1. **Submit a test feedback** from the form
2. **Check the Feedback table** in Airtable for a new record with Status = "New"
3. **Check Slack** for the notification message
4. **Check GAS Executions** for the submitFeedback run log

---

## How to Edit This Script

The feedback form has two files:
- `FeedbackForm.gs` -- the server-side logic (API calls, triage, Airtable writes)
- `FeedbackFormUI.html` -- the client-side form (HTML, CSS, JavaScript)

Both are edited in the GAS editor or via clasp:
1. **GAS editor:** Open the project and find the files in the file list
2. **clasp:** Edit locally and push with `clasp push --force`

**After any code change**, you may need to create a new deployment (Deploy > New deployment) for the changes to take effect in the web app.
