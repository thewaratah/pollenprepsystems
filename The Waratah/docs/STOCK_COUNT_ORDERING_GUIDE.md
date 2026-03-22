# The Waratah — Stock Count & Weekly Ordering Guide

**Last Updated:** 2026-03-22
**Audience:** Evan (primary counter/orderer), management (placing orders)

This is the complete guide to bar stock counting and weekly ordering at The Waratah. It covers everything from initialising a count session through to placing orders with suppliers. If you follow these steps each week, the system handles the maths and generates your ordering document automatically.

---

## What Is the Stock Count?

*Why we count bar stock and how it feeds into ordering.*

Every week, we physically count the bar's essential stock — roughly 59 "Core Order" items. These are the spirits, wines, beers, key mixers, and dual-use prep ingredients that keep the bar running.

The count covers **5 physical areas** of the venue. Once all areas are counted, the system automatically:

1. Compares your on-hand quantities against each item's par level (the target amount we want in stock)
2. Checks what the prep recipes need this week
3. Calculates exactly how much to order for each item
4. Generates an ordering document grouped by supplier
5. Sends a Slack notification so you know it is ready

You count. The system does the maths.

---

## Before You Start — Initialising the Count

*How to create a fresh counting session before the physical stocktake.*

Before you walk the floor, you need to create a new count session. Just like prep counting, all stock count functions are run via **Airtable Interfaces** — you never need to open raw tables or access data directly.

1. Open the **Stock Count Interface** in Airtable
2. Press the **Init Stock Count** button
3. The system will:
   - Create a new Count Session record
   - Generate ~59 placeholder Stock Count records (one for every Core Order item)
   - Delete the previous session's Stock Count and Stock Order records (the session record itself is kept for history)
   - Load the previous session's counts as a reference point
   - Set the session status to **"In Progress"**

Once the status shows "In Progress", counting can begin.

**Note:** It is safe to re-run Init if something goes wrong before you start counting. It will delete the old placeholders and create fresh ones.

---

## How to Count — The 5-Area Walkthrough

*A step-by-step guide to counting each area of the venue.*

All ~59 Core Order items are displayed in a single sorted list (Item Name A-Z) in the **Stock Count Interface**. As you walk through each area, you fill in that area's tally column for every item. You never need to open the underlying tables — the Interface shows exactly what you need.

### Public Bar

*The main bar service area and its surrounding storage.*

**Physical locations covered:**
- Under PB Station
- PB Backbar
- PB Fridge

Walk the Public Bar area and enter the quantity of each item you find. If an item is not present in this area, enter **0**.

### Terrace Bar

*The outdoor bar area and its surrounding storage.*

**Physical locations covered:**
- Under TB Station
- TB Backbar
- TB Fridge

Same process — walk the Terrace Bar and record what you see. Enter **0** for anything not stored here.

### Banquettes

*The banquettes service area and freezer storage.*

**Physical locations covered:**
- Banquettes area
- Freezer

Check both the banquettes area and the freezer. Some items (particularly frozen garnishes or specialty products) may only appear here.

### Cool Rooms

*Refrigerated storage areas used across the venue.*

**Physical locations covered:**
- Hallway
- Keg Room
- Cool Room

This is where bulk stock, kegs, and temperature-sensitive items live. Count carefully — it is easy to miss items behind other stock.

### Back Storage

*Dry storage and overflow stock.*

**Physical locations covered:**
- B1

Back storage often holds cases and backup bottles. Count full units and partial units separately if needed.

---

### Counting Rules

*The rules that keep your count clean and the system happy.*

| Rule | Detail |
|------|--------|
| **Enter a number for EVERY item in EVERY area** | The system needs a value in each tally column |
| **0 = item not present in this area** | This is correct and expected — most items only appear in 1-2 areas |
| **Blank = "not counted"** | The system will block completion if any tally is blank |
| **Use the Stock Count Interface** | All ~59 Core Order items are listed A-Z — work through them systematically |
| **Fill each area's column as you walk it** | Do not try to fill multiple areas at once |

---

## Completing the Count

*What happens when you press the Complete button.*

Once you have walked all 5 areas and filled in every tally column:

1. Press the **Complete Stock Count** button in the Interface
2. The system runs a pre-flight check:
   - Verifies that every item has a value in **Total On Hand** (the formula that sums all 5 area tallies)
   - If any item has a blank Total On Hand, the system **refuses to complete** and tells you which items are missing
3. If all items pass, the session status changes to **"Completed"**

**What happens next is fully automatic:**

```
Complete → Validated → Orders Generated + REQUESTED → Doc generated → Slack notification
```

- **ValidateStockCount** runs automatically after completion
- **GenerateStockOrders** runs automatically after validation
- **Ordering doc export** is triggered automatically after orders are generated
- **Slack notification** is sent to Evan once the doc is ready

You press one button. The pipeline does the rest.

---

## The Ordering Pipeline

*How your count turns into an ordering document — step by step.*

Here is exactly what happens after you press Complete:

### Step 1: ValidateStockCount (automatic)

*Checks your count data for errors and outliers.*

- Confirms no items have null or blank totals
- Flags statistical outliers: any count that is more than 3x or less than 0.2x the previous session's count
- If everything looks good, status advances to **"Validated"**
- If issues are found, status goes to **"Needs Review"** (contact Evan)

### Step 2: GenerateStockOrders (automatic)

*Calculates how much to order for each item.*

For every Core Order item, the system:
- Looks up the item's **par level** (target stock quantity)
- Looks up **prep usage** from the latest Prep Run's Ingredient Requirements
- Calculates the **order quantity** using the ordering formula (see next section)
- Creates a Stock Order record with supplier, quantity, and unit information

This step also sets the **Ordering Export State** to "REQUESTED", which triggers the doc export.

### Step 3: Export (automatic via GAS polling)

*Generates the ordering document and sends notification.*

- The Google Apps Script polling process detects the "REQUESTED" state
- Generates the **Combined Ordering Run Sheet** in Google Drive
- Sends a **Slack notification** to Evan with a link to the document
- Sets the Ordering Export State to "COMPLETED"

---

## How the Ordering Formula Works

*The maths behind each order quantity, in plain English.*

For each item, the system calculates two things and adds them together:

### Service Shortfall

```
Service Shortfall = MAX(0, Par Level - Total On Hand)
```

This answers: **"How much do we need to get back to par for bar service?"**

- If you have 3 bottles and par is 6, the shortfall is 3
- If you have 7 bottles and par is 6, the shortfall is 0 (you are already above par)

### Prep Usage

```
Prep Usage = quantity needed from Ingredient Requirements (latest Prep Run)
```

This answers: **"How much does the prep schedule need this week?"**

Some items are used in both bar service and prep recipes. The system pulls the prep requirement automatically from the most recent Prep Run.

### Combined Order

```
Combined Order = Service Shortfall + Prep Usage
```

This answers: **"Total amount to order — shelf restock plus what prep needs."**

### Worked Example

| | Value |
|---|---|
| **Item** | Hendricks Gin |
| **Total On Hand** | 3 bottles |
| **Par Level** | 6 bottles |
| **Prep Usage** | 1 bottle |
| **Service Shortfall** | MAX(0, 6 - 3) = **3 bottles** |
| **Combined Order** | 3 + 1 = **4 bottles** |

The ordering doc will show: `Hendricks Gin  |  4x Bottles`

---

## Reading the Combined Ordering Run Sheet

*How to read and use the ordering document.*

The ordering doc is a Google Doc generated automatically after your count is completed. Here is how it is structured:

### Header

- Session date
- Counted by (who completed the count)

### Items Grouped by Supplier

Each supplier gets its own section with:
- **Supplier name** as a heading
- **Email address or ordering method** listed under the heading
- Individual line items in this format:

```
Item Name  |  Nx Bottles
```

For items measured in millilitres, the system converts to bottles using the item's Order Volume. For items already in cases, kegs, or other units, the display reflects that:

```
Item Name  |  Nx Units
```

### Andie's Orders (from Prep Count)

Below the stock count orders, you will see a section headed **"ANDIE'S ORDERS (from Prep Count)"**. These are items sourced from the weekly prep count that Andie is responsible for ordering. They are grouped by supplier in the same format as the stock count section above. Items that are already in the stock count (Core Order items) are excluded — the system avoids double-ordering.

### Blade's Orders (from Prep Count)

Below Andie's section, you will see **"BLADE'S ORDERS (from Prep Count)"**. These are items sourced from the weekly prep count — mainly non-alcoholic suppliers like fruit and veg, prep pantry, and pantry staples. They are grouped by supplier in the same format.

All sections use the same clean format — just the item name and quantity (e.g., `Item Name  |  2x Bottles`).

### Special Sections

**PREP-ONLY ITEMS** — Items that appear at the bottom of the document. These are prep ingredients not assigned to Andie or Blade and not part of the regular stock count. They still need to be ordered but are tracked through the prep system.

**ITEMS BELOW PAR — NO SUPPLIER** — Stock count items that need ordering but do not have a supplier assigned in Airtable. If you see items here, contact Evan to get the supplier field updated.

---

## Placing Orders

*The management workflow for ordering from the doc.*

Once the ordering document is generated:

1. **Slack notification** arrives in Evan's channel with a link to the doc
2. The doc is also available in the **Google Drive ordering folder**
3. Management reviews the document and places orders with each supplier
4. **Orders must be placed before 2pm Monday** to ensure Tuesday delivery
5. Use the supplier emails and ordering methods listed in the document — each supplier section includes their contact details

---

## Re-running or Fixing a Count

*What to do if something went wrong with the count.*

| Situation | What to Do |
|-----------|------------|
| **Count not yet completed** | Go back into the Stock Count Interface and fix the numbers. No need to re-initialise. |
| **Already completed but orders look wrong** | Contact Evan. The export can be re-triggered, or specific stock count values can be corrected and orders regenerated. |
| **Need to start completely over** | Safe to re-run Init Stock Count. It will delete all existing Stock Count and Stock Order records for the current session and create fresh placeholders. |
| **Previous session data looks wrong** | Previous session records are kept for history but their Stock Count and Stock Order records are cleaned up when a new session is initialised. Contact Evan if you need to review historical data. |

---

## Common Counting Mistakes

*What goes wrong most often and how to avoid it.*

| Mistake | What Happens | How to Avoid |
|---------|--------------|--------------|
| Leaving a tally blank | System refuses to complete the count | Always enter **0** for items not present in an area |
| Counting in wrong units | Order quantities will be calculated incorrectly | Units are shown in the Interface — if something looks wrong, contact Evan |
| Not pressing Complete | Orders and docs will not generate | Press Complete once all 5 areas are done |
| Counting the wrong items | Some items may be missed or double-counted | Use the sorted Interface view — all ~59 Core Order items are listed alphabetically |
| Skipping an area | Tallies for that area will be blank, blocking completion | Follow the 5-area walkthrough in order |
| Counting opened/partial bottles inconsistently | Totals may be slightly off week to week | Decide on a convention (e.g., count opened bottles as 0.5) and stick to it |

---

## Troubleshooting

*Quick fixes for common ordering issues.*

| Problem | What to Do |
|---------|------------|
| Cannot find the ordering doc | Check Slack first, then the Google Drive ordering folder. If missing, contact Evan. |
| Ordering doc has wrong quantities | Check the stock counts in the Interface — a miscount in one area will throw off the total. May need a re-count or par level adjustment. |
| Supplier missing from the doc | The item may not have a supplier assigned. Check the NEEDS ASSIGNMENT section and contact Evan to update the supplier field. |
| Stock count was not initialised | The Init Stock Count button needs to be pressed in the Interface before counting. Contact Evan if you do not have access. |
| "Total On Hand" shows blank | One or more tally fields are empty for that item. Go back and enter a number (including 0) for every area. |
| Count completed but no Slack notification | The GAS polling process may be delayed (runs every 1-2 minutes). Wait a few minutes. If still nothing after 5 minutes, contact Evan. |
| Ordering Export State stuck on REQUESTED | The GAS polling trigger may not be running. Contact Evan to check the trigger in the Apps Script dashboard. |
| Outlier flagged during validation | The system detected a count that is dramatically different from last week. Double-check the item — if the count is correct, Evan can override. |

---

## Weekly Timeline

*When each step happens in the weekly cycle.*

| When | What | Who |
|------|------|-----|
| **Sunday** | Physical stocktake | Evan |
| **Monday AM** | Init Stock Count (if not done Sunday) | Evan |
| **Monday AM** | Complete Stock Count | Evan |
| **Monday AM** | Pipeline runs automatically (validate, generate orders, export doc) | System |
| **Monday before 2pm** | Place orders with suppliers | Management |
| **Tuesday** | Deliveries arrive | Bar staff |
| **Tuesday-Wednesday** | Prep runs completed | Bar staff |

---

*For questions about the stock count system, par level adjustments, or supplier setup, contact Evan.*
