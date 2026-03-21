# PREP SYSTEM - Deep Dive Technical Reference

**For:** Developers, system administrators, and anyone modifying or extending the system.

---

## Architecture Overview
*How data flows from Airtable through GAS to Google Docs and Slack.*

### User Interaction Layer

Staff and managers interact with the system through **Airtable Interfaces** — purpose-built dashboards with buttons, forms, and filtered views. They never access raw tables directly. The trigger chain is:

```
Interface Button (user clicks)
    → Airtable Automation (runs script)
        → Script executes (reads/writes Airtable data)
            → For exports: calls GAS webhook → Google Docs + Slack
```

Scheduled automations (ClearPrepData, ClearWeeklyCount) run on timers and do not require user interaction. All other automations (FinaliseCount, GeneratePrepRun, GeneratePrepSheet) are triggered by Interface buttons.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AIRTABLE                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Items     │  │   Recipes    │  │  Par Levels  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Weekly Counts│  │  Prep Runs   │  │  Prep Tasks  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │Ingredient Req│  │   Supplier   │  │  Audit Log   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  [Automations] ─────────────────────────────────────────────────────│
│  ClearWeeklyCount │ FinaliseCount │ GeneratePrepRun │ GeneratePrepSheet
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Webhook (POST)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GOOGLE APPS SCRIPT                                │
│                                                                      │
│  GoogleDocsPrepSystem.gs                                            │
│  ├── doPost(e)           → Webhook handler                          │
│  ├── processPrepRunExportRequests() → Poll-based trigger           │
│  ├── exportPrepRun()     → Main orchestrator                        │
│  ├── createOrderingList()                                           │
│  ├── createBatchingList()                                           │
│  ├── createIngredientPrepList()                                     │
│  └── sendSlackNotification()                                        │
└─────────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
              ┌──────────────────┐   ┌──────────────────┐
              │   GOOGLE DOCS    │   │      SLACK       │
              │                  │   │                  │
              │ - Ordering Lists │   │ - Gooch channel  │
              │ - Batching List  │   │ - Sabs channel   │
              │ - Ingredient Prep│   │ - Prep channel   │
              └──────────────────┘   └──────────────────┘
```

---

## Script Reference
*Version info, file locations, and execution environments for each script.*

### Location
All scripts: `/scripts/`

### Script Versions
All Airtable scripts: **v2.0** (with audit logging), except:
- GeneratePrepRun: **v3.0** (dynamic reorder points + buffer multiplier)
- ClearPrepData: **v1.0** (Friday AM cleanup)

GoogleDocsPrepSystem: **v4.2** (hybrid template engine)

---

## ClearPrepData.gs

**Purpose:** Delete all Prep Tasks and Ingredient Requirements (Friday AM cleanup)

**Trigger:** Airtable Automation — scheduled trigger, Friday 8:00 AM (automatic; no Interface button needed)

**Version:** 1.0

**Algorithm:**
```javascript
1. Query all records from Prep Tasks table
2. Delete in batches of 50
3. Query all records from Ingredient Requirements table
4. Delete in batches of 50
5. Log to Audit Log
```

**Configuration:**
```javascript
const CONFIG = {
  tasksTableName: "Prep Tasks",
  reqTableName: "Ingredient Requirements",
  auditLogTableName: "Audit Log",
  timeZone: "Australia/Sydney"
};
```

**Supports:** `dryRun: true` for safe validation.

---

## ClearWeeklyCount.gs

**Purpose:** Initialize new stocktake session

**Trigger:** Airtable Automation — scheduled trigger, Saturday 8:00 AM (automatic; can also be triggered via Interface button)

**Algorithm:**
```javascript
1. Query all Active items (Batch, Sub Recipe, Garnish, Other)
2. Delete existing Weekly Counts records (optional: preserve verified)
3. Create new placeholder record for each item
4. Log to Audit Log
```

**Configuration Constants:**
```javascript
const CONFIG = {
  tables: {
    items: 'Items',
    weeklyCounts: 'Weekly Counts',
    auditLog: 'Audit Log'
  },
  batchSize: 50,
  timeZone: 'Australia/Sydney',
  preserveVerified: false  // Set true to keep previous verified counts
};
```

**Key Fields Created:**
- Item (link to Items)
- Stock Count (null - to be filled)
- Count Date (current date)
- Confirmed (false)

---

## FinaliseCount.gs

**Purpose:** Validate and lock stocktake data

**Trigger:** Airtable Automation — manager clicks **Finalise Count** button in the Interface during Saturday shift

**Algorithm:**
```javascript
1. Query Weekly Counts where Confirmed = false
2. Validate each record:
   - Has valid Item link
   - Has Stock Count value
3. Optional: Validate recipe integrity
   - Sub Recipe items have recipes
   - Recipe components exist
   - Yields defined
4. Set Confirmed = true on valid records
5. Set Count Source = "Stocktake (Verified)"
6. Log results to Audit Log
```

**Validation Modes:**
- `WARNING` - Log issues but continue
- `ERROR` - Stop on first issue

**Configuration:**
```javascript
const CONFIG = {
  batchSize: 50,
  maxBlankItemsToShow: 25,
  maxRecipeIssuesToShow: 25,
  recipeValidation: 'WARNING'  // or 'ERROR'
};
```

---

## GeneratePrepRun.gs

**Purpose:** Calculate prep requirements from stocktake

**Trigger:** Airtable Automation — manager clicks **Generate Prep Run** button in the Interface during Saturday shift (after FinaliseCount)

**Algorithm:**
```javascript
1. Find latest verified stocktake (max Count Date where Confirmed = true)
2. Load Par Levels for all items
3. For each item in stocktake:
   a. Calculate shortfall = Par Level - Stock Count
   b. If shortfall > 0:
      - Find recipe that produces this item
      - Calculate batches = ceil(shortfall / recipe yield)
      - Create Prep Task record
4. For each Prep Task:
   a. Load Recipe Lines (ingredients)
   b. For each ingredient:
      - Calculate total needed = ingredient qty × batches
      - Create/update Ingredient Requirement
5. Group Ingredient Requirements by Supplier + Ordering Staff
6. Log to Audit Log
```

**Buffer Multiplier:**
```javascript
// Per-item buffer (default 1.0)
const bufferMultiplier = item.fields['Buffer Multiplier'] || 1.0;
const suggestedQty = targetQty * bufferMultiplier;

// Writes to "Suggested Qty (Buffer)" field
```

**Duplicate Detection:**
- Checks if prep run already exists for this stocktake date
- Prevents accidental duplicate runs
- Can be overridden with `allowDuplicate: true`

---

## GeneratePrepSheet.gs

**Purpose:** Bridge between Airtable automation and Google Apps Script

**Trigger:** Airtable Automation — manager clicks **Export** button in the Interface during Saturday shift (after GeneratePrepRun)

**Algorithm:**
```javascript
1. Poll "Prep Run Requests" table for status = "Pending"
2. For each pending request:
   a. Update status to "Processing"
   b. Call Google Apps Script webhook with requestId
   c. On success: Update status to "Done"
   d. On failure: Update status to "Failed", log error
```

**Webhook Payload:**
```javascript
{
  secret: MANUAL_TRIGGER_SECRET,
  runId: "recXXXXXXX",
  mode: "LIVE" | "TEST",
  notifySlack: true | false
}
```

---

## GoogleDocsPrepSystem.gs

**Purpose:** Generate documents, send notifications, and route web app requests

**Deployment:** Google Apps Script Web App

**Entry Points:**

1. `doGet(e)` - Unified router for Feedback Form and Recipe Scaler
2. `doPost(e)` - Webhook handler for manual triggers
3. `processPrepRunExportRequests()` - Poll-based trigger (time-driven)

### Unified Web App Router (v4.2)

A single deployment serves both the Feedback Form and Recipe Scaler:

```javascript
function doGet(e) {
  const page = (e.parameter.page || 'feedback').toLowerCase();
  if (page === 'scaler') {
    return doGetRecipeScaler(e);  // From RecipeScaler.gs
  } else {
    return doGetFeedback(e);      // From FeedbackForm.gs
  }
}
```

**URL Routing:**
- `<deployment-url>` → Feedback Form (default)
- `<deployment-url>?page=scaler` → Recipe Scaler

**Configuration:**
Both `FEEDBACK_FORM_URL` and `RECIPE_SCALER_URL` should be set to the same deployment URL.

### Hybrid Template Engine (v4.2)

Templates provide branding; code provides content.

**Template Structure:**
```
┌─────────────────────────────────────────┐
│  [LOGO]                                 │
│  {{STAFF_NAME}} Ordering List           │  ← From template
│  {{DATE}} • {{RUN_LABEL}}               │
├─────────────────────────────────────────┤
│  {{CONTENT}}                            │  ← Marker (removed)
│                                         │
│  [Dynamic content inserted here         │  ← From code
│   by appendContent() functions]         │
│                                         │
└─────────────────────────────────────────┘
```

**Placeholder Replacement:**
```javascript
body.replaceText('{{DATE}}', formattedDate);
body.replaceText('{{RUN_LABEL}}', runLabel);
body.replaceText('{{STAFF_NAME}}', staffName);

// Find {{CONTENT}} marker, remove it, insert content at that position
const contentMarker = body.findText('{{CONTENT}}');
if (contentMarker) {
  const element = contentMarker.getElement();
  const parent = element.getParent();
  // Insert all dynamic content here
  // Remove the marker paragraph
}
```

**Fallback:** If template ID not set or template missing, full programmatic generation.

### Document Generation Functions
Functions that build each Google Doc type from Airtable data.

**createOrderingList(doc, staffName, ingredients)**
```javascript
// Groups ingredients by supplier
// For each supplier:
//   - Supplier header
//   - Table with columns: Item, Qty, Unit
// Applies 1.5x buffer formatting
```

**createBatchingList(doc, prepTasks)**
```javascript
// For each batch task:
//   - Batch name header
//   - Batches needed
//   - Ingredient bullets with quantities
//   - Method/instructions
```

**createIngredientPrepList(doc, subRecipeTasks)**
```javascript
// Groups sub-recipe tasks by the batch they're needed for
// For each batch:
//   - Batch header
//   - Sub-recipe items needed
```

### Slack Integration
Webhook routing for LIVE and TEST mode notifications.

**Webhook URLs (from Script Properties):**
- `SLACK_WEBHOOK_GOOCH` - Gooch's channel
- `SLACK_WEBHOOK_SABS` - Sabs' channel
- `SLACK_WEBHOOK_PREP` - Prep team channel
- `SLACK_WEBHOOK_EV_TEST` - Test channel

**LIVE Mode Notifications:**
```javascript
sendSlack(GOOCH_WEBHOOK, goochDocUrl, folderUrl);
sendSlack(SABS_WEBHOOK, sabsDocUrl, folderUrl);
sendSlack(PREP_WEBHOOK, [ingredientPrepUrl, batchingUrl], folderUrl);
```

**TEST Mode Notifications:**
```javascript
// All docs to test channel only
sendSlack(TEST_WEBHOOK, [all doc URLs], folderUrl);
```

---

## Script Properties Reference

Configure in Google Apps Script → Project Settings → Script Properties

| Property | Description | Example |
|----------|-------------|---------|
| `AIRTABLE_BASE_ID` | Airtable base identifier | `appNsFRhuU47e9qlR` |
| `AIRTABLE_PAT` | Personal Access Token | `patXXXXXX.XXXXXX` |
| `DOCS_FOLDER_ID` | Google Drive folder for docs | `1ABC...XYZ` |
| `SLACK_WEBHOOK_GOOCH` | Gooch channel webhook | `https://hooks.slack.com/...` |
| `SLACK_WEBHOOK_SABS` | Sabs channel webhook | `https://hooks.slack.com/...` |
| `SLACK_WEBHOOK_PREP` | Prep channel webhook | `https://hooks.slack.com/...` |
| `SLACK_WEBHOOK_EV_TEST` | Test channel + feedback notifications | `https://hooks.slack.com/...` |
| `MANUAL_TRIGGER_SECRET` | Webhook authentication | Random string |
| `TEMPLATE_ORDERING_ID` | Ordering list template doc | Google Doc ID |
| `TEMPLATE_BATCHING_ID` | Batching list template doc | Google Doc ID |
| `TEMPLATE_INGREDIENT_PREP_ID` | Ingredient prep template | Google Doc ID |
| `FEEDBACK_FORM_URL` | Unified deployment URL | `https://script.google.com/.../exec` |
| `RECIPE_SCALER_URL` | Same as FEEDBACK_FORM_URL | `https://script.google.com/.../exec` |

**Note:** `FEEDBACK_FORM_URL` and `RECIPE_SCALER_URL` should be set to the **same** deployment URL. The unified router handles routing via URL parameters.

---

## Airtable Schema Details
*Field definitions for every table in the Sakura Airtable base.*

### Items Table

| Field | Type | Notes |
|-------|------|-------|
| Item Name | Single line text | Primary field |
| Item Type | Single select | Batch, Sub Recipe, Garnish, Other |
| Active | Checkbox | Include in stocktake |
| Unit | Single line text | g, ml, each, etc. |
| Supplier | Link to Supplier | |
| Buffer Multiplier | Number | Default 1.0 (100%) |

### Recipes Table

| Field | Type | Notes |
|-------|------|-------|
| Recipe Name | Single line text | |
| Item Name | Link to Items | What this recipe produces |
| Yield Qty | Number | Output per batch |
| Method | Long text | Instructions |

### Recipe Lines Table

| Field | Type | Notes |
|-------|------|-------|
| Recipe | Link to Recipes | Parent recipe |
| Item | Link to Items | Ingredient |
| Qty | Number | Amount per batch |

### Weekly Counts Table

| Field | Type | Notes |
|-------|------|-------|
| Item | Link to Items | |
| Stock Count | Number | Physical count |
| Count Date | Date | Normalized to midnight |
| Count Source | Single select | Stocktake (Verified), Manual, etc. |
| Confirmed | Checkbox | Locked by FinaliseCount |

### Prep Runs Table

| Field | Type | Notes |
|-------|------|-------|
| Run Date | Date | |
| Label | Formula/Text | e.g., "2026-02-03" |
| Link to Prep Guides | URL | Populated by export |
| Export Request State | Single select | REQUESTED, IN_PROGRESS, DONE, FAILED |
| Export Mode | Single select | LIVE, TEST |
| Export Notify Slack | Checkbox | |
| Export Requested At | Date | |
| Export Finished At | Date | |
| Export Last Error | Long text | Error message if failed |
| Export Last Result | Long text | JSON result |

### Prep Tasks Table

| Field | Type | Notes |
|-------|------|-------|
| Prep Run | Link to Prep Runs | |
| Item Needed | Link to Items | What to produce |
| Recipe Used | Link to Recipes | |
| Target Qty | Number | Shortfall amount |
| Batches Needed | Number | ceil(Target / Yield) |
| Suggested Qty (Buffer) | Number | Target × Buffer Multiplier |
| Notes | Long text | |

### Ingredient Requirements Table

| Field | Type | Notes |
|-------|------|-------|
| Prep Run | Link to Prep Runs | |
| Item Link | Link to Items | Ingredient needed |
| Total Qty Needed | Number | Sum across all recipes |
| Supplier Name (Static) | Text | Denormalised for grouping |
| Ordering Staff (Static) | Text | Gooch or Sabs |

### Audit Log Table

| Field | Type | Notes |
|-------|------|-------|
| Timestamp | Date | Created time |
| Script Name | Single select | Which automation |
| Status | Single select | Success, Warning, Error |
| Message | Single line text | Summary |
| Details | Long text | Full execution log |
| User | Single line text | Last Modified By |
| Execution Time (seconds) | Number | |
| Error Stack | Long text | Stack trace if error |
| Config Used | Long text | JSON of config |

### Feedback Table

| Field | Type | Notes |
|-------|------|-------|
| Prep Run | Link to Prep Runs | Context |
| Doc Type | Single select | Ingredient Prep List, Batching List, Gooch Ordering, Sabs Ordering |
| Staff Name | Single line text | Submitter name |
| Staff Role | Single select | Prep Team, Ordering - Gooch, Ordering - Sabs, Manager, Other |
| Feedback Type | Single select | Missing Data, Recipe Issue, Suggestion, Other |
| Description | Long text | Full feedback |
| Item Reference | Link to Items | Optional |
| Recipe Reference | Link to Recipes | Optional |
| AI Category | Single select | Data Fix, Recipe Update, General |
| AI Suggestion | Long text | System recommendation |
| AI Confidence | Number | 0-100 |
| Item Exists Check | Checkbox | Auto-filled for Missing Data |
| Found Recipe Line | Link to Recipe Lines | Auto-filled for Recipe Issue |
| Status | Single select | New, In Review, Actioned, Resolved, Dismissed |
| Slack Notified | Checkbox | |
| Created At | Date | |
| Notes | Long text | Admin notes |

---

## Deployment
*clasp setup, push commands, and which files are excluded from GAS.*

### clasp Configuration

**Files:**
- `scripts/.clasp.json` - Project link
- `scripts/appsscript.json` - Manifest
- `scripts/.claspignore` - Exclusions

**Commands:**
```bash
cd scripts/

# Push changes to Google Apps Script
clasp push

# Force push (overwrite)
clasp push --force

# Pull remote changes
clasp pull

# Open in browser
clasp open
```

**Ignored Files (Airtable-only):**
- ClearWeeklyCount.gs
- FinaliseCount.gs
- GeneratePrepRun.gs
- GeneratePrepSheet.gs
- GoogleDocsPrepSystem_TestHarness.gs

---

## RecipeScaler.gs

**Purpose:** Scale recipes based on available ingredient quantities

**Version:** 1.1 (unified router integration)

**Entry Points:**

1. `doGetRecipeScaler(e)` - Serves the Recipe Scaler HTML (called by unified router)
2. `getRecipeList()` - Returns all recipes for dropdown
3. `getRecipeDetails(recipeId)` - Returns recipe with ingredients
4. `calculateScaledRecipe(recipeId, ingredientId, availableQty)` - Calculates scaled quantities

**Access URL:** `<deployment-url>?page=scaler`

**Algorithm:**
```javascript
1. Get recipe and its ingredient lines
2. Find the constraining ingredient's quantity per batch
3. Calculate scale factor = availableQty / ingredientQtyPerBatch
4. Apply scale factor to all ingredients
5. Calculate scaled yield
6. Return scaled recipe with all quantities
```

**UI File:** `scripts/RecipeScalerUI.html` - Responsive HTML/CSS/JS interface

**Script Properties Required:**
- Same as GoogleDocsPrepSystem (AIRTABLE_BASE_ID, AIRTABLE_PAT)

---

## FeedbackForm.gs

**Purpose:** Staff feedback collection with AI triage

**Version:** 1.1 (unified router integration)

**Entry Points:**

1. `doGetFeedback(e)` - Serves the Feedback Form HTML (called by unified router, default route)
2. `getFormConfig()` - Returns dropdown options
3. `searchItems(query)` - Autocomplete search for items
4. `searchRecipes(query)` - Autocomplete search for recipes
5. `submitFeedback(data)` - Main submission handler

**Access URL:** `<deployment-url>` (no page parameter needed)

**Submission Flow:**
```javascript
1. Validate required fields
2. Run AI triage to categorize feedback
3. Check item existence (for "Missing Data" type)
4. Find related Recipe Lines (for "Recipe Issue" type)
5. Create Feedback record in Airtable
6. Send Slack notification to SLACK_WEBHOOK_EV_TEST
7. Return success response
```

**AI Triage Categories:**
- **Data Fix** - Missing items, incorrect par levels
- **Recipe Update** - Wrong quantities, missing ingredients
- **General** - Suggestions, other feedback

**UI File:** `scripts/FeedbackFormUI.html` - Mobile-friendly form interface

**URL Parameters:**
- `?prepRunId=recXXX` - Pre-fill prep run context
- `?docType=Batching List` - Pre-fill document type
- `?staffRole=Prep Team` - Pre-fill staff role

### Airtable Automation URLs

Stored in `config/airtableautomationURLs` (gitignored)

| Automation | URL Pattern |
|------------|-------------|
| ClearWeeklyCount | `https://airtable.com/appXXX/wflXXX` |
| FinaliseCount | `https://airtable.com/appXXX/wflXXX` |
| GeneratePrepRun | `https://airtable.com/appXXX/wflXXX` |
| GeneratePrepSheet | `https://airtable.com/appXXX/wflXXX` |

---

## Error Handling Patterns
*Retry logic, audit logging, and dry-run support used across all scripts.*

### Retry with Backoff
Exponential backoff wrapper for UrlFetchApp calls.

```javascript
function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        return response;
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      Utilities.sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### Audit Logging
Writes execution metadata and errors to the Audit Log table.

```javascript
async function logToAudit(scriptName, status, message, details = {}) {
  await createRecord('Audit Log', {
    fields: {
      'Timestamp': new Date().toISOString(),
      'Script Name': scriptName,
      'Status': status,
      'Message': message,
      'Details': JSON.stringify(details, null, 2),
      'User': details.user || 'System',
      'Execution Time (seconds)': details.executionTime || 0,
      'Error Stack': details.errorStack || '',
      'Config Used': JSON.stringify(CONFIG)
    }
  });
}
```

### Dry Run Mode
Validates logic and logs planned changes without writing to Airtable.

```javascript
function main(options = { dryRun: false }) {
  const { dryRun } = options;

  // ... processing ...

  if (dryRun) {
    console.log('DRY RUN - Would create:', results);
    return { dryRun: true, preview: results };
  }

  // Actual writes
  await createRecords(results);
}
```

---

## Testing
*Test harness, mode switching, and dry-run validation for safe development.*

### Test Harness

`GoogleDocsPrepSystem_TestHarness.gs` provides isolated testing:

```javascript
function testDocGeneration() {
  const mockData = {
    prepRun: { id: 'recTEST', label: 'Test' },
    prepTasks: [...],
    ingredients: [...]
  };

  const result = exportPrepRun(mockData, { testMode: true });
  console.log(result);
}
```

### TEST vs LIVE Mode
Controls Slack routing and is set per export request.

| Aspect | TEST | LIVE |
|--------|------|------|
| Documents | Created in same folder | Created in same folder |
| Slack | All to test channel | To team channels |
| Use | Verification, training | Production |

### Dry Run

All Airtable scripts support `dryRun: true`:
- Validates logic
- Logs what would happen
- Makes no changes

---

## Extension Points
*Where and how to add new item types, document types, and integrations.*

### Adding New Item Types

1. Add to Items table "Item Type" single select options
2. Update ClearWeeklyCount filter if needed
3. Update document generation if type-specific formatting needed

### Adding New Document Types

1. Create template (optional)
2. Add template ID to Script Properties
3. Add generation function to GoogleDocsPrepSystem.gs
4. Update exportPrepRun() to call new function
5. Add Slack notification if needed

### Adding New Integrations

See `reference/integrations/` for available MCP servers:
- `airtable-mcp2/` - 33+ Airtable tools
- `xero-mcp-server/` - Accounting integration
- `python-slack-sdk/` - Advanced Slack features

### Custom Calculations

Modify GeneratePrepRun.gs:
- `calculateShortfall()` - Change par comparison logic
- `calculateBatches()` - Change batch rounding
- Buffer multiplier logic

---

## Development Workflow

See `.claude/skills/` for development tools:

1. **Brainstorming** → Design new features
2. **Create Plans** → Structure implementation
3. **Subagent Development** → Execute with reviews
4. **Debugging** → Systematic troubleshooting
5. **Compound Docs** → Document solutions

**Critical Patterns:** `docs/solutions/patterns/critical-patterns.md`

---

## Security Considerations
*Credential storage, input validation, and Airtable rate-limit compliance.*

### Credential Storage
- All credentials in Script Properties (not code)
- Config files gitignored
- Never commit actual tokens

### Input Validation
- Validate webhook payloads
- Check secret before processing
- Sanitize Airtable data before doc insertion

### Rate Limiting
- Airtable: 5 requests/second
- Batch operations use 50 record batches
- Delays between batches prevent throttling

---

## Performance Considerations
*Batch sizes, caching strategies, and GAS execution limits.*

### Batch Sizes
- Airtable operations: 50 records
- Prevents timeouts and rate limits

### Caching
- Recipe data can be cached per session
- Item lookups can be memoized

### Google Apps Script Limits
- Execution time: 6 minutes (standard)
- UrlFetchApp timeout: 30 seconds
- Document operations: Can be slow for large docs

---

## Monitoring
*Audit Log queries and GAS execution logs for diagnosing failures.*

### Audit Log Queries
Airtable filter patterns for common monitoring tasks.

**Recent errors:**
```
Filter: Status = "Error", Timestamp >= [24 hours ago]
```

**Script performance:**
```
Group by: Script Name
Aggregate: AVG(Execution Time), COUNT(*)
```

**Failure rate:**
```
Filter: Script Name = "GoogleDocsPrepSystem"
Calculate: COUNT(Error) / COUNT(*) * 100
```

### Google Apps Script Logs

1. Go to script.google.com
2. Select project
3. View → Executions
4. Filter by status/date

---

## Related Documentation
*Links to companion guides and required-reading patterns.*

- [CLAUDE.md](../CLAUDE.md) - System overview and developer guide
- [STAFF_GUIDE.md](STAFF_GUIDE.md) - Staff quick start
- [MANAGER_GUIDE.md](MANAGER_GUIDE.md) - Manager guide
- [AIRTABLE_SCHEMA.md](AIRTABLE_SCHEMA.md) - Complete Airtable base schema
- [Critical Patterns](solutions/patterns/critical-patterns.md) - Required reading
