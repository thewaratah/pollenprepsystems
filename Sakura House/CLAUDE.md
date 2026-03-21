# SAKURA HOUSE PREP SYSTEM

A kitchen prep management system integrating Airtable, Google Apps Script, Google Docs, and Slack. Automates the weekly cycle from stocktake through prep task generation, document creation, and team notifications.

**Last Updated:** 2026-03-21
**Status:** Production ✅
**Airtable Base:** `appNsFRhuU47e9qlR`
**GAS Script ID:** `1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM`

---

## Folder Structure
*Where every file lives and what it does.*

```
Sakura House/
├── scripts/                          # All GAS + Airtable scripts
│   ├── ClearWeeklyCount.gs           # Airtable: initialize stocktake session
│   ├── ClearPrepData.gs              # Airtable: Friday AM cleanup (v1.0)
│   ├── FinaliseCount.gs              # Airtable: validate & lock stocktake
│   ├── GeneratePrepRun.gs            # Airtable: generate prep tasks (v3.0)
│   ├── GeneratePrepSheet.gs          # Airtable: export request processor
│   ├── GoogleDocsPrepSystem.gs       # GAS: main doc exporter + Slack (v4.2)
│   ├── GoogleDocsPrepSystem_TestHarness.gs  # GAS: test harness
│   ├── FeedbackForm.gs              # GAS: staff feedback web app (v1.1)
│   ├── FeedbackFormUI.html          # Feedback form UI
│   ├── RecipeScaler.gs              # GAS: constraint-based recipe scaling (v1.1)
│   ├── RecipeScalerUI.html          # Recipe scaler UI
│   ├── .clasp.json                  # GAS project link
│   ├── .claspignore                 # Excludes Airtable-only scripts from GAS
│   └── appsscript.json              # GAS manifest (Sydney timezone, V8)
│
├── docs/
│   ├── AIRTABLE_SCHEMA.md           # Complete Airtable base schema reference
│   ├── STAFF_GUIDE.md               # Quick start for staff (stocktake workflow)
│   ├── MANAGER_GUIDE.md             # Manager guide (config, troubleshooting)
│   ├── TECHNICAL_REFERENCE.md       # Developer reference (script internals)
│   ├── plans/
│   │   └── 2026-02-20-negligible-stock-decrements-design.md
│   └── solutions/patterns/
│       ├── common-solutions.md      # Searchable solution library
│       └── critical-patterns.md     # Required reading for devs
│
├── config/                          # Sensitive config (GITIGNORED)
│   ├── GoogleDocsPrepSystemScriptProperties
│   └── airtableautomationURLs
│
└── CLAUDE.md                        # This file
```

---

## Weekly Cycle
*The end-to-end automation sequence from Friday cleanup through Saturday shift.*

```
FRIDAY 8 AM          SATURDAY 8 AM        SATURDAY SHIFT (3:30 PM–3 AM)        SUNDAY–WEDNESDAY
    │                     │                     │                                    │
    ▼                     ▼                     ▼                                    ▼
ClearPrepData        ClearWeeklyCount      Staff count stock                    Sun–Mon: orders arrive,
(scheduled:          (scheduled:           Manager finalises count              extra ordering
 delete Prep Tasks    reset counts,        → GeneratePrepRun                    Tue–Wed: orders arrive,
 + Ingredient Req)    create placeholders) → GeneratePrepSheet                  prep is done
                                           → GoogleDocsPrepSystem
                                           → Slack notifications
                                           Ordering also done during shift
```

**Ordering staff:** Gooch, Sabs
**Weekly cycle:** Friday AM cleanup → Saturday AM reset → Saturday night shift (count, finalise, generate, export, order) → Sun–Wed (deliveries + prep)

---

## Airtable Interfaces
*How staff and managers interact with the system — nobody uses raw tables directly.*

Staff and managers access the PREP system through **Airtable Interfaces** — purpose-built dashboards with buttons, forms, and filtered views. They do not open raw Airtable tables.

**What users can do from Interfaces:**
- Clear the weekly count (button)
- Enter and review stock counts
- Finalise the count (button)
- Generate the prep run (button)
- Trigger prep sheet export (button)
- Adjust weekly par levels and weekly volumes

**Access levels:**
| Role | Access | Notes |
|------|--------|-------|
| Staff | Interfaces only | Count stock, view prep tasks, check results |
| Managers | Interfaces for the weekly cycle | Run automations via buttons, adjust par/volume settings |
| Admins | Raw tables + Interfaces | Add items, suppliers, recipes; troubleshoot data issues |

The automations documented below (ClearWeeklyCount, FinaliseCount, etc.) are the same scripts — the only difference is that they are **triggered by Interface buttons**, not by navigating to raw tables.

---

## Script Reference
*What each script does, its version, and where it runs.*

### Airtable Automation Scripts

These run inside Airtable automations (NOT deployed to GAS). Staff and managers trigger them via **Interface buttons**:

| Script | Version | Purpose |
|--------|---------|---------|
| `ClearWeeklyCount.gs` | v2.0 | Reset Weekly Counts table, create placeholders for active items |
| `ClearPrepData.gs` | v1.0 | Friday AM: delete all Prep Tasks + Ingredient Requirements |
| `FinaliseCount.gs` | v2.0 | Validate counts, set Confirmed=true, mark as "Stocktake (Verified)" |
| `GeneratePrepRun.gs` | v3.0 | Calculate shortfalls, generate Prep Tasks + Ingredient Requirements |
| `GeneratePrepSheet.gs` | v2.0 | Poll Prep Run Requests, call GAS webhook to trigger export |

### GAS Scripts (deployed via clasp)
These are pushed to Google Apps Script via clasp and run in the cloud.

| Script | Version | Purpose |
|--------|---------|---------|
| `GoogleDocsPrepSystem.gs` | v4.2 | Hybrid template engine: generate 4 Google Docs + Slack notifications |
| `FeedbackForm.gs` | v1.1 | Staff feedback collection with AI triage |
| `RecipeScaler.gs` | v1.1 | Constraint-based recipe scaling web app |

### Unified Web App Router

A single GAS deployment serves both web apps:
- `<deployment-url>` → Feedback Form (default)
- `<deployment-url>?page=scaler` → Recipe Scaler

Both `FEEDBACK_FORM_URL` and `RECIPE_SCALER_URL` Script Properties point to the same deployment URL.

---

## Key Calculations
*Formulas used to determine what to prep and how much.*

### Shortfall & Batching (GeneratePrepRun v3.0)

```
Shortfall = Par Level - Stock Count

If item has Weekly Volume (ml):
  Reorder Point = (Weekly Volume × 1.05) / 1.10
  Only trigger prep if Stock Count < Reorder Point

Batches Needed = ceil(Shortfall / Recipe Yield)
Suggested Qty = Target Qty × Buffer Multiplier (default 1.0)
```

### Buffer Multiplier (GoogleDocsPrepSystem v4.2)

All document quantities show: `base (1.5× = buffered)`
Example: `100ml (1.5× = 150ml)`

Per-item override via "Buffer Multiplier" field on Items table.

---

## Hybrid Template Engine (v4.2)
*How Google Docs are generated from templates with dynamic content injection.*

Templates provide branding (logo, headers); code provides all dynamic content.

```
Template: [Logo] + {{DATE}} + {{RUN_LABEL}} + {{STAFF_NAME}} + {{CONTENT}} marker
Code:     Replaces placeholders, then inserts dynamic content at {{CONTENT}} position
Fallback: Full programmatic generation if template missing
```

Template IDs stored in Script Properties: `TEMPLATE_ORDERING_ID`, `TEMPLATE_BATCHING_ID`, `TEMPLATE_INGREDIENT_PREP_ID`

---

## Output Documents
*The four Google Docs generated per prep run and who receives them.*

Each export creates 4 Google Docs in a dated folder:

| Document | Audience | Content |
|----------|----------|---------|
| Gooch Ordering List | Gooch | Items grouped by supplier (Gooch's suppliers) |
| Sabs Ordering List | Sabs | Items grouped by supplier (Sabs' suppliers) |
| Batching List | Prep team | Batch tasks with ingredients, quantities, methods |
| Ingredient Prep List | Prep team | Sub-recipe tasks grouped by parent batch |

### Slack Notifications

**LIVE mode:** Each doc link sent to its recipient's Slack channel
**TEST mode:** All doc links sent to test channel only

---

## Script Properties Reference
*All GAS Script Properties keys required for production.*

Configure in Google Apps Script → Project Settings → Script Properties:

| Property | Description |
|----------|-------------|
| `AIRTABLE_BASE_ID` | `appNsFRhuU47e9qlR` |
| `AIRTABLE_PAT` | Personal Access Token |
| `DOCS_FOLDER_ID` | Google Drive folder for generated docs |
| `SLACK_WEBHOOK_GOOCH` | Gooch's Slack channel webhook |
| `SLACK_WEBHOOK_SABS` | Sabs' Slack channel webhook |
| `SLACK_WEBHOOK_PREP` | Prep team channel webhook |
| `SLACK_WEBHOOK_EV_TEST` | Test channel + feedback notifications |
| `MANUAL_TRIGGER_SECRET` | Webhook auth secret |
| `TEMPLATE_ORDERING_ID` | Ordering list template doc ID |
| `TEMPLATE_BATCHING_ID` | Batching list template doc ID |
| `TEMPLATE_INGREDIENT_PREP_ID` | Ingredient prep template doc ID |
| `FEEDBACK_FORM_URL` | Unified deployment URL |
| `RECIPE_SCALER_URL` | Same as FEEDBACK_FORM_URL |

---

## clasp Deployment
*How to push, pull, and verify GAS scripts.*

```bash
cd "Sakura House/scripts"
clasp push --force     # Deploy to GAS
clasp pull             # Pull remote changes
clasp open             # Open in browser
clasp status           # Verify what gets pushed
```

**.claspignore** excludes Airtable-only scripts from GAS deployment:
- `ClearWeeklyCount.gs`, `ClearPrepData.gs`, `FinaliseCount.gs`
- `GeneratePrepRun.gs`, `GeneratePrepSheet.gs`
- `GoogleDocsPrepSystem_TestHarness.gs`

---

## Critical Rules
*Hard rules that must never be violated -- breaking these causes production failures.*

1. **Ordering staff are Gooch and Sabs** — never Andie/Blade (those are Waratah)
2. **Recipe name field is `Recipe Name`** (plain text) — never `Item Name` (that's Waratah)
3. **All credentials in Script Properties** — no hardcoded base IDs, PATs, webhooks (P0)
4. **`clearContent()` not `clear()`** — `clear()` destroys formatting and validations (P0)
5. **Item Types:** Batch, Sub Recipe, Sub-recipe, Ingredient, Garnish, Other (8 types)
6. **Light-mode web apps:** White card UIs must set `color: '#1a1a1a'` explicitly

---

## Documentation
*Supporting docs for staff, managers, and developers.*

| Document | Audience | Purpose |
|----------|----------|---------|
| [AIRTABLE_SCHEMA.md](docs/AIRTABLE_SCHEMA.md) | Developers | Complete base schema with all 17 tables |
| [STAFF_GUIDE.md](docs/STAFF_GUIDE.md) | Staff | Daily workflow, stocktake process |
| [MANAGER_GUIDE.md](docs/MANAGER_GUIDE.md) | Managers | Configuration, troubleshooting |
| [TECHNICAL_REFERENCE.md](docs/TECHNICAL_REFERENCE.md) | Developers | Script internals, algorithms, deployment |
| [critical-patterns.md](docs/solutions/patterns/critical-patterns.md) | Developers | Required reading — common pitfalls |
