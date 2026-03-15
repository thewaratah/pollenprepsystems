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

Each automation is triggered by a button in Airtable.

### 1. Clear Weekly Count
**When:** Saturday morning (start of stocktake)
**What it does:**
- Resets the Weekly Counts table
- Creates placeholder records for all active items
- Prepares system for new stocktake

**Configuration:**
- Only processes items where `Active = true`
- Filters by Item Type: Batch, Sub Recipe, Garnish, Other

### 2. Finalise Count
**When:** Monday morning (after stocktake complete)
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
**When:** Monday (after finalising count)
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
**When:** After "Export" button clicked
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

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Items** | Product catalogue | Item Name, Item Type, Active, Unit, Supplier |
| **Recipes** | Production recipes | Item Name (link), Yield Qty |
| **Recipe Lines** | Ingredients per recipe | Recipe (link), Item (link), Qty |
| **Par Levels** | Stock targets | Item Link, Par Qty |

### Operational Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Weekly Counts** | Stocktake data | Item, Stock Count, Confirmed |
| **Prep Runs** | Prep sessions | Date, Link to Prep Guides, Export State |
| **Prep Tasks** | Items to produce | Item Needed, Batches Needed, Target Qty |
| **Ingredient Requirements** | Shopping list | Item Link, Total Qty Needed, Supplier |

### System Tables

| Table | Purpose |
|-------|---------|
| **Prep Run Requests** | Export queue |
| **Supplier** | Vendor info + ordering staff assignment |
| **Audit Log** | Execution history |
| **Feedback** | Staff feedback submissions |

---

## Configuration Tasks

### Adding a New Item

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

1. Go to **Par Levels** table
2. Find the item
3. Update Par Qty
4. Changes take effect on next prep run

### Adding a New Supplier

1. Add to **Supplier** table:
   - Supplier Name
   - Ordering Staff (Gooch or Sabs)

2. Link items to supplier in **Items** table

### Changing Ordering Staff Assignment

1. Go to **Supplier** table
2. Change "Ordering Staff" field
3. Affects which ordering list the supplier appears on

---

## Output Documents

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

### LIVE Mode
- Documents created in production folder
- Slack messages sent to team channels:
  - Gooch → Gooch's channel
  - Sabs → Sabs' channel
  - Prep → Prep team channel

### TEST Mode
- Documents created in same folder
- ALL Slack messages go to test channel only
- No team notifications

**When to use TEST:**
- Verifying system works after changes
- Training new staff
- Debugging issues

---

## Troubleshooting

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

| Type | Use For |
|------|---------|
| **Missing Data** | Items or ingredients missing from lists |
| **Recipe Issue** | Wrong quantities, missing steps, unclear instructions |
| **Suggestion** | Ideas for improvement |
| **Other** | Anything else |

### How Feedback Works

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

### Weekly Schedule

| Day | Action | Who |
|-----|--------|-----|
| Saturday AM | Run Clear Weekly Count | Manager |
| Sat-Sun | Enter stock counts | Staff |
| Monday AM | Run Finalise Count | Manager |
| Monday PM | Run Generate Prep Run | Manager |
| Monday PM | Click Export | Manager |
| Tue-Fri | Execute prep tasks | Team |

### Key URLs

- Airtable Base: Check with admin
- Google Drive Folder: Check Script Properties
- Slack Channels: Configured per team

---

## Next Level

For technical details, script internals, and development:
→ [Deep Dive Guide](README-Level3-DeepDive.md)

For basic daily use:
→ [Quick Start Guide](README-Level1-Basic.md)
