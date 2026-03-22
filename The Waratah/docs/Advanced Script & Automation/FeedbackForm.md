# FeedbackForm.gs -- Feedback Form Explainer

**Script:** `FeedbackForm.gs` + `FeedbackFormUI.html`
**Environment:** Google Apps Script (deployed via clasp as part of the same GAS project)
**Access:** Web app URL stored in Script Property `FEEDBACK_FORM_URL`

---

## What It Does

The Feedback Form is a web app that allows bar staff (Andie, Blade, and the prep team) to submit feedback about prep documents. It:

1. Serves an HTML form via `doGetFeedback()`
2. Provides item and recipe search with autocomplete
3. Accepts feedback categorised by type (Missing Data, Recipe Issue, Suggestion, Other)
4. Optionally uses AI triage to categorise and suggest actions
5. Logs feedback to the Airtable `Feedback` table
6. Sends Slack notifications to the admin channel

---

## How Bar Staff Access It

The form is accessible via a URL link. This link can be:
- Embedded in prep documents (Ingredient Prep List, Batching Run Sheet)
- Shared directly via Slack or other channels
- Accessed with URL parameters to pre-fill context:
  - `?prepRunId=recXXX` -- links feedback to a specific Prep Run
  - `?docType=Ingredient Prep List` -- pre-selects the document type
  - `?staffRole=Ordering - Andie` -- pre-selects the staff role

---

## Recipe Name Resolution Pattern

This is an important pattern specific to The Waratah. The Waratah Recipes table uses `Item Name` as a **linked record field** pointing to the Items table -- NOT a plain text "Recipe Name" field (which is what Sakura House uses).

The `searchRecipes()` function resolves recipe names by:
1. Fetching all active Items and building an `id --> name` map
2. Fetching all Recipes (which have `Item Name` as linked record IDs)
3. Resolving each recipe's name by looking up the linked item ID in the Items map
4. Filtering by the search query

This three-step pattern is consistent across FeedbackForm.gs, RecipeScaler.gs, and the Knowledge Platform API routes.

---

## Configuration

The `FEEDBACK_CONFIG` object defines:

| Setting | Value | Notes |
|---------|-------|-------|
| `tables.feedback` | `"Feedback"` | Table where feedback is stored |
| `tables.items` | `"Items"` | For item search autocomplete |
| `tables.recipes` | `"Recipes"` | For recipe search autocomplete |
| `feedbackTypes` | Missing Data, Recipe Issue, Suggestion, Other | Dropdown options |
| `docTypes` | Ingredient Prep List, Batching List, Andie Ordering, Blade Ordering | Document type dropdown |
| `staffRoles` | Prep Team, Ordering - Andie, Ordering - Blade, Manager, Other | Staff role dropdown |

---

## Key Functions

| Function | Called By | Purpose |
|----------|----------|---------|
| `doGetFeedback(e)` | `doGet()` router in GoogleDocsPrepSystem.gs | Serves the HTML form |
| `getFormConfig()` | Client-side JavaScript | Returns dropdown options for the form |
| `getPrepRunDetails(prepRunId)` | Client-side JavaScript | Fetches Prep Run context to display on the form |
| `searchItems(query)` | Client-side JavaScript | Autocomplete search for items (searches `Item Name` field) |
| `searchRecipes(query)` | Client-side JavaScript | Autocomplete search for recipes (resolves via linked record pattern) |
| `submitFeedback(data)` | Client-side JavaScript | Saves feedback to Airtable and sends Slack notification |

---

## Airtable Integration

- **Base ID:** From Script Property `AIRTABLE_BASE_ID` (`appfcy14ZikhKZnRS`)
- **API Key:** From Script Property `AIRTABLE_PAT`
- **Uses:** `airtableListAll_()` helper (defined in GoogleDocsPrepSystem.gs) for paginated Airtable queries

---

## Slack Notifications

Feedback submissions send Slack notifications to:
- `SLACK_WEBHOOK_WARATAH_PREP` (primary)
- Falls back to `SLACK_WEBHOOK_EV_TEST` if the primary is not set

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| Form shows blank page | GAS web app deployment is broken or URL is wrong | Check `FEEDBACK_FORM_URL` in Script Properties and verify the deployment is active |
| Item/recipe search returns nothing | Airtable credentials missing or wrong base ID | Check `AIRTABLE_BASE_ID` and `AIRTABLE_PAT` in Script Properties |
| Feedback not saved | `Feedback` table does not exist in Airtable, or field names do not match | Create the Feedback table or verify field names |
| Slack notification not sent | Webhook URL not configured | Set `SLACK_WEBHOOK_WARATAH_PREP` or `SLACK_WEBHOOK_EV_TEST` |
| Text appears invisible on form | Dark theme CSS issue -- text color not explicitly set | Text elements must have `color: '#1a1a1a'` set explicitly (the global foreground is cream-colored and invisible on white card backgrounds) |

---

## How to Edit

1. **FeedbackForm.gs:** Edit in GAS editor or locally, then `clasp push --force`
2. **FeedbackFormUI.html:** Same -- edit in GAS editor or locally, then push
3. After editing, you may need to create a new deployment for changes to take effect (Deploy --> New deployment in GAS editor)
4. Update the `FEEDBACK_FORM_URL` Script Property if the deployment URL changes
