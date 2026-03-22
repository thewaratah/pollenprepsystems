# The Waratah — Ordering, Count & Prep System Overview

**Last Updated:** 2026-03-22

Welcome to The Waratah's automated ordering and prep system. This document explains how the whole thing works — from counting stock on Sunday through to prepping on Tuesday and Wednesday. Whether you're brand new or just need a refresher, this is the place to start.

---

## What Is the PREP System?

*A quick explanation of what the system does and why it exists.*

The PREP system takes the manual work out of figuring out what to order and what to prep each week. It connects four things together:

1. **Airtable** — where stock counts and recipes live
2. **Google Apps Script** — the engine that crunches the numbers
3. **Google Docs** — the prep sheets and ordering docs you actually read
4. **Slack** — where the finished documents get sent to you

In plain English: **you count stock, the system calculates what to prep and order, creates the documents, and sends them to Slack.** No spreadsheets, no guesswork.

---

## The Two Systems

*There are actually two linked systems working together behind the scenes.*

### Prep System

*Handles batches, sub-recipes, and everything that gets made in-house.*

This system tracks par levels (targets) for all the things we make ourselves — batches, sub-recipes, garnishes, and other prep items. After stocktake, it compares what we have against what we need, calculates the shortfall, and generates two prep documents:

- **Batching Run Sheet** — full batch recipes with ingredients, quantities, and method
- **Ingredient Prep Run Sheet** — sub-recipes, garnishes, and prep items

### Stock Count & Ordering System

*Handles bar stock — spirits, wines, beers, mixers — and generates the ordering doc.*

This system tracks roughly 59 "Core Order" items across 5 counting areas behind the bar. Each item has a par level (the target amount we want on hand). After you count everything, the system compares your counts against those targets and calculates what needs to be ordered.

### How They Connect

*Both systems produce one unified ordering document for management.*

Both systems feed into **one combined ordering document** — the Combined Ordering Run Sheet. This single doc covers everything: bar stock that needs reordering AND ingredients needed for prep. Management uses this one document to place all orders.

---

## The Weekly Cycle

*What happens each week, when it happens, and who does what.*

| When | What Happens | Who Does It |
|------|-------------|-------------|
| **Sunday (before counting)** | Stock count initialised — system creates a new session with ~59 items, all tally fields empty | Evan (Init button) |
| **Sunday** | Physical stocktake — walk the 5 counting areas, enter counts for every item | Evan |
| **Sunday (after counting)** | Complete Stock Count button pressed — system checks every item has been counted | Evan |
| **Sunday -- Monday** | Validation, order generation, and ordering doc export run automatically | Automatic |
| **Monday morning** | Prep Run generated — system calculates shortfalls and creates prep tasks | Automatic |
| **Monday morning** | Prep docs created (Ingredient Prep + Batching Run Sheets) and Slack notifications sent | Automatic |
| **Monday** | Ordering completed by management before 2pm using the combined ordering doc | Management |
| **Tuesday** | Orders arrive from suppliers | Supplier delivery |
| **Tuesday -- Wednesday** | Execute prep tasks from the docs | Bar staff |

**The golden rule of counting:** Every item must have a number in all tally fields. Enter **0** if there is no stock. Never leave a field blank — blank means "not counted" and the system will refuse to complete the stocktake.

---

## Who Does What

*Your role in the weekly cycle.*

| Role | Who | What They Do |
|------|-----|-------------|
| **Bar Manager** | Evan | Initialises stock count on Sunday, does the physical stocktake, triggers the ordering doc |
| **Management** | TBD | Places orders using the combined ordering doc before 2pm Monday |
| **Bar Staff** | The team | Execute prep tasks Tuesday--Wednesday using the Batching + Ingredient Prep docs |

If you are on the bar team, your main interaction with the system is on Tuesday and Wednesday — following the prep documents that arrive in Slack on Monday morning.

Everyone benefits from understanding the full cycle, even if your role only touches part of it. Knowing when orders are placed and when deliveries arrive helps you plan your prep time and flag problems early.

---

## What You'll Get Each Week

*The three documents the system creates for you, and what's in each one.*

Every week the system generates three Google Docs and posts links to them in Slack. Here is what each one contains.

### Ingredient Prep Run Sheet

*Sub-recipes, garnishes, and prep items — the things you make before batching.*

Each item on this sheet includes:
- **Item name** and the quantity to make ("To Make"), with a buffer built in
- **Full ingredient list** with quantities
- **Method** — step-by-step instructions
- **Recipe Scaler link** — click to scale the recipe up or down if needed
- **Additional Tasks section** — any extra notes or tasks for that item

### Batching Run Sheet

*Full batch recipes — the big items you make in bulk.*

Same layout as the Ingredient Prep sheet: item name, "To Make" quantity, ingredients, method, Recipe Scaler link, and Additional Tasks. These are the larger batches that often depend on the sub-recipes from the Ingredient Prep sheet, so do those first.

### Combined Ordering Run Sheet

*One document for all ordering — bar stock and prep ingredients together.*

This is a single document with all items grouped by supplier. For each item it shows:
- **Item name**
- **Order quantity** in bottles or order units (not millilitres)

It covers both regular bar stock (spirits, wines, beers, mixers) and any ingredients needed specifically for prep. Management uses this one doc to place every order.

### Where to Find Them

*How documents are delivered and where they are stored.*

Documents are delivered two ways:
1. **Slack** — notifications with direct links arrive Monday morning
2. **Google Drive** — all documents are saved in the shared prep folder (link below)

New documents are created each week in a dated subfolder, so you can always go back and check a previous week's lists if you need to.

---

## Two Handy Tools

*Built-in helpers you can access from any prep document.*

### Recipe Scaler

*Scale any recipe up or down to match what you have on hand.*

Every prep document includes a "Scale this recipe" link next to each item. Click it to open the Recipe Scaler, where you can:
- Select any recipe from the full list
- Enter your target quantity
- See every ingredient scaled proportionally

This is useful when you do not have enough of one ingredient to make a full batch, or when you need to make a different quantity than what the system suggests.

### Feedback Form

*Report issues, flag missing data, or suggest improvements.*

Every prep document includes a "Have feedback? Submit here" link at the top. Use it when:
- An ingredient is missing or wrong
- A quantity looks off
- A recipe method needs updating
- You have a suggestion for how things could work better

Your feedback goes straight to Airtable and triggers a Slack notification so it gets seen quickly.

---

## Key Links and Contacts

*Where to go and who to ask.*

| Resource | Where to Find It |
|----------|-----------------|
| **Google Drive Prep Folder** | [Open folder](https://drive.google.com/drive/folders/1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx) |
| **Recipe Scaler** | Link in every prep doc, or ask Evan for the URL |
| **Feedback Form** | Link in every prep doc, or ask Evan for the URL |
| **Airtable Interfaces** | Open the Airtable app → The Waratah base → Interfaces (all counting and prep actions are done here) |

**For all system issues, missing data, or feature requests:** contact Evan.

---

## Quick Reference Card

*The weekly cycle at a glance — tear this out and stick it on the wall.*

**Weekly timeline:**
- **Sunday:** Init stock count, count all 5 areas, press Complete when done
- **Monday AM:** Prep docs arrive in Slack
- **Monday:** Ordering completed before 2pm
- **Tuesday:** Deliveries arrive
- **Tuesday -- Wednesday:** Execute prep tasks from the docs

**Rules to remember:**
- Always enter **0** for no stock — never leave a field blank
- Always press the **Complete** button when the count is finished
- Do Ingredient Prep items **before** Batching items (batches often depend on sub-recipes)
- Check the "To Make" quantity on each item — it already includes a safety buffer

**Something wrong?**
- Document looks off? Use the **feedback link** at the top of the doc.
- System not working? Contact **Evan**.
- Recipe needs scaling? Use the **Recipe Scaler** link next to the item.

---

*Last updated 2026-03-22. Questions? Ask Evan or use the feedback link on any document.*
