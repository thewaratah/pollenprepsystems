# PREP SYSTEM - Intermediate Guide

**For:** Managers, supervisors, and anyone configuring or troubleshooting the system.

---

## System Overview

PREP SYSTEM connects four platforms:

```
Airtable (Data & Automations)
    ↓
Google Apps Script (Processing)
    ↓
Google Docs (Output Documents)
    ↓
Slack (Team Notifications)
```

---

## The Five Core Automations

These automations run either on scheduled triggers or are initiated by the manager via **Airtable Interface buttons** during Saturday shift. Staff and managers interact with the system through Interfaces (purpose-built dashboards) — not by opening raw tables.

### 1. Clear Weekly Count
**When:** Saturday 8:00 AM (automated scheduled trigger — can also be triggered via Interface button)
**What it does:**
- Resets the Weekly Counts table
- Creates placeholder records for all active items
- Prepares system for new stocktake

**Configuration:**
- Only processes items where `Active = true`
- Filters by Item Type: Batch, Sub Recipe, Garnish, Other

### 2. Finalise Count
**When:** Saturday shift — manager clicks the **Finalise Count** button in the Interface after stock count is complete
**What it does:**
- Validates all counts are entered
- Sets `Confirmed = true` on valid counts
- Marks count source as "Stocktake (Verified)"
- Checks recipe integrity (warnings only)

**Validation checks:**
- Every item must have a stock count
- Recipe items should have valid recipes
- Recipe yields must be defined

### 3. Generate Prep Run
**When:** Saturday shift — manager clicks the **Generate Prep Run** button in the Interface after finalising count
**What it does:**
- Finds latest verified stocktake
- Calculates shortfalls: `Par Level - Current Stock`
- Creates Prep Tasks for items below par
- Calculates batches needed: `Shortfall ÷ Recipe Yield`
- Creates Ingredient Requirements (BOM explosion)

**Key calculation:**
```
If Par Level = 100 and Stock = 30
Then Shortfall = 70

If Recipe Yield = 25 per batch
Then Batches Needed = ceil(70 ÷ 25) = 3 batches
```

### 4. Generate Prep Sheet (Webhook Trigger)
**When:** Saturday shift — manager clicks the **Export** button in the Interface after prep run is generated
**What it does:**
- Polls Prep Run Requests table
- Calls Google Apps Script webhook
- Updates request status

### 5. Google Docs Export
**When:** Triggered by Generate Prep Sheet
**What it does:**
- Creates 4 Google Docs in a dated folder
- Sends Slack notifications to appropriate channels
- Updates Prep Run with folder link

---

## Airtable Tables Reference
*Every table in the system and what it stores.*

> **Note:** These are the underlying data tables. Staff and managers interact with the system through **Airtable Interfaces** — purpose-built dashboards with buttons and filtered views. The tables below are referenced here for troubleshooting and admin configuration.

### Core Tables
These tables define your products, recipes, and stock targets.

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Items** | Product catalogue | Item Name, Item Type, Active, Unit, Supplier |
| **Recipes** | Production recipes | Item Name (link), Yield Qty |
| **Recipe Lines** | Ingredients per recipe | Recipe (link), Item (link), Qty |
| **Par Levels** | Stock targets | Item Link, Par Qty |

### Operational Tables
These tables hold live stocktake, prep run, and ordering data.

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Weekly Counts** | Stocktake data | Item, Stock Count, Confirmed |
| **Prep Runs** | Prep sessions | Date, Link to Prep Guides, Export State |
| **Prep Tasks** | Items to produce | Item Needed, Batches Needed, Target Qty |
| **Ingredient Requirements** | Shopping list | Item Link, Total Qty Needed, Supplier |

### System Tables
These tables manage exports, suppliers, logging, and feedback.

| Table | Purpose |
|-------|---------|
| **Prep Run Requests** | Export queue |
| **Supplier** | Vendor info + ordering staff assignment |
| **Audit Log** | Execution history |
| **Feedback** | Staff feedback submissions |

---

## Configuration Tasks
*Common setup changes. Par levels and weekly volumes can be adjusted from the Interface. Adding new items, suppliers, or recipes requires admin access to the raw tables.*

### Adding a New Item
Register a new product so it appears in stocktakes and prep runs. *This requires admin access to the raw tables — it cannot be done from the Interface alone.*

1. Add to **Items** table with:
   - Item Name
   - Item Type (Batch, Sub Recipe, Garnish, Other)
   - Active = checked
   - Unit (g, ml, each, etc.)
   - Supplier (link)

2. Add to **Par Levels** table:
   - Link to the item
   - Set Par Qty

3. If it's produced (not purchased):
   - Create entry in **Recipes** table
   - Add ingredients in **Recipe Lines** table

### Adjusting Par Levels
Change how much stock the system targets for an item.

1. Open the **PREP Interface** in Airtable
2. Find the item and adjust the **Par Qty** value (par levels and weekly volumes are editable from the Interface)
3. Changes take effect on the next prep run

*For bulk changes or troubleshooting, admins can also edit the Par Levels table directly.*

### Adding a New Supplier
Create a supplier record and assign it to an ordering staff member. *This requires admin access to the raw tables.*

1. Add to **Supplier** table:
   - Supplier Name
   - Ordering Staff (Gooch or Sabs)

2. Link items to supplier in **Items** table

### Changing Ordering Staff Assignment
Reassign a supplier so its orders appear on a different staff member's list. *This requires admin access to the raw tables.*

1. Go to **Supplier** table
2. Change "Ordering Staff" field
3. Affects which ordering list the supplier appears on

---

## Output Documents
*The four Google Docs generated each prep cycle.*

### 1. Ingredient Prep List
**Audience:** Prep team
**Content:** Sub-recipe tasks grouped by the batch they're needed for
**Use:** Know what sub-recipes to prepare before batching

### 2. Batching List
**Audience:** Prep team
**Content:** Batch tasks with:
- Ingredients and quantities
- Method/instructions
- Number of batches needed

### 3. Gooch Ordering List
**Audience:** Gooch (ordering staff)
**Content:** Items grouped by supplier for Gooch's suppliers

### 4. Sabs Ordering List
**Audience:** Sabs (ordering staff)
**Content:** Items grouped by supplier for Sabs' suppliers

---

## Buffer Multiplier

The system applies a 1.5x buffer to all quantities.

**Display format:** `100ml (1.5× = 150ml)`

This means:
- Base calculation says 100ml needed
- System suggests ordering/making 150ml
- Provides safety margin for waste, mistakes, variance

**Per-item override:** Set "Buffer Multiplier" field on Items table (default 1.0 = 100%)

---

## LIVE vs TEST Mode
*Control whether exports go to the team or to a test channel.*

### LIVE Mode
Production mode -- documents and notifications reach the whole team.
- Documents created in production folder
- Slack messages sent to team channels:
  - Gooch → Gooch's channel
  - Sabs → Sabs' channel
  - Prep → Prep team channel

### TEST Mode
Safe sandbox -- all notifications route to the test channel only.
- Documents created in same folder
- ALL Slack messages go to test channel only
- No team notifications

**When to use TEST:**
- Verifying system works after changes
- Training new staff
- Debugging issues

---

## Troubleshooting
*Common issues and how to resolve them.*

### Export Stuck in "Processing"

**Symptoms:** Prep Run Request shows "Processing" for more than 5 minutes

**Check:**
1. Audit Log for errors
2. Google Apps Script execution log
3. Webhook URL is correct

**Fix:**
- If error found, fix and re-trigger export
- Can set status back to "Pending" to retry

### Missing Items in Prep Tasks

**Symptoms:** Item below par but no prep task created

**Check:**
1. Is item Active?
2. Does item have a Par Level?
3. Was item included in stocktake (Weekly Counts)?
4. Does item have a Recipe with Yield Qty?

### Wrong Quantities

**Symptoms:** Numbers don't match expectations

**Check:**
1. Par Level correct?
2. Stock count correct?
3. Recipe yield correct?
4. Recipe lines (ingredients) correct?

### No Slack Notifications

**Symptoms:** Export completed but no Slack message

**Check:**
1. Export mode - TEST only sends to test channel
2. "Notify Slack" checkbox enabled?
3. Webhook URLs configured in Script Properties?

---

## Audit Log

Every automation logs to the Audit Log table:

| Field | Content |
|-------|---------|
| Timestamp | When it ran |
| Script Name | Which automation |
| Status | Success, Warning, Error |
| Message | Summary |
| Details | Full execution log |
| Execution Time | How long it took |

**Use for:**
- Confirming automations ran
- Finding error details
- Performance monitoring

---

## Recipe Scaler

The Recipe Scaler is a web app for calculating scaled recipes based on available ingredients.

**Use case:** You have 500ml of lime juice but the recipe calls for 200ml per batch. How many batches can you make and what are all the scaled quantities?

**Access:**
- Click "Scale this recipe" link in any Batching List document
- Or access directly via the deployed web app URL with `?page=scaler`

**How it works:**
1. Select a recipe from the dropdown
2. Choose a "constraining ingredient" (the one you have limited supply of)
3. Enter how much of that ingredient you have
4. Get scaled quantities for all ingredients

---

## Feedback System

Staff can submit feedback directly from generated documents using the "Have feedback? Submit here" link at the top of each document.

### Feedback Types
Choose the category that best describes the issue.

| Type | Use For |
|------|---------|
| **Missing Data** | Items or ingredients missing from lists |
| **Recipe Issue** | Wrong quantities, missing steps, unclear instructions |
| **Suggestion** | Ideas for improvement |
| **Other** | Anything else |

### How Feedback Works
End-to-end flow from staff submission to manager notification.

1. Staff click feedback link in document
2. Form pre-fills with document context (prep run, doc type, staff role)
3. Staff describe the issue and optionally select related item/recipe
4. System auto-categorizes feedback using AI triage
5. Notification sent to admin Slack channel
6. Record created in Feedback table

### Managing Feedback

View submitted feedback in the **Feedback** table in Airtable:

| Field | Purpose |
|-------|---------|
| Status | New → In Review → Actioned → Resolved |
| AI Category | Auto-categorized: Data Fix, Recipe Update, General |
| AI Suggestion | System recommendation for resolution |
| Item Reference | Related item (if selected) |
| Recipe Reference | Related recipe (if selected) |

### Configuration

Feedback notifications are sent to the `SLACK_WEBHOOK_EV_TEST` webhook (same as TEST mode exports).

---

## Quick Reference
*At-a-glance schedules and links for day-to-day operations.*

### Weekly Schedule
The weekly prep cycle at a glance.

| Day | Action | Who |
|-----|--------|-----|
| Friday 8 AM | ClearPrepData runs (deletes old prep data) | Automatic (scheduled) |
| Saturday 8 AM | ClearWeeklyCount runs (resets stocktake) | Automatic (scheduled) |
| Saturday shift | Count stock via the Airtable Interface | Staff |
| Saturday shift | Finalise Count | Manager |
| Saturday shift | Generate Prep Run | Manager |
| Saturday shift | Export sheets + Slack notifications | Manager |
| Saturday shift | Place orders | Gooch / Sabs |
| Sun–Mon | Orders arrive, extra ordering if needed | Suppliers / team |
| Tue–Wed | Orders arrive, prep is done | Team |

### Key URLs
Bookmark these for quick access to each platform.

- Airtable Base: Check with admin
- Google Drive Folder: Check Script Properties
- Slack Channels: Configured per team

---

## Next Level

For technical details, script internals, and development:
→ [Technical Reference](TECHNICAL_REFERENCE.md)

For basic daily use:
→ [Staff Guide](STAFF_GUIDE.md)
