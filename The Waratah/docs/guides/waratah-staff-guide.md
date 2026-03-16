# The Waratah — PREP System Staff Guide

**Last Updated:** 2026-03-16

This guide explains how the PREP system works at The Waratah and how to use each part of it. It is written for bar staff — no technical knowledge required.

---

## 1. What Is the PREP System?

The PREP system tracks what we have in stock, calculates what needs to be prepped each week, and generates your prep lists and ordering lists as Google Docs. When the docs are ready, you get a notification on Slack with links to everything.

The system handles four things automatically:
- **Counting** — tracks what stock we have on hand
- **Prep lists** — calculates what needs to be made based on par levels minus current stock
- **Ordering list** — works out what ingredients to order, grouped by supplier, in a single combined ordering doc
- **Notifications** — sends Slack messages with links to the docs when they are ready

---

## 2. The Weekly Cycle

Here is what happens each week and when:

| When | What Happens | Who Does It |
|------|-------------|-------------|
| **Saturday morning** | Weekly counts are automatically cleared — the system resets for the new week | Automatic |
| **Sunday** | Physical stocktake — count every item and enter quantities in the Airtable Interface | Bar staff |
| **Monday morning** | Stocktake and count is finalised — the system locks in your counts and checks for any missing entries | Automatic |
| **Monday morning** | Prep Run is generated — the system calculates shortfalls (par level minus stock on hand) and creates prep tasks | Automatic |
| **Monday morning** | Prep docs are created (Ingredient Prep + Batching Run Sheets) and Slack notifications are sent with links | Automatic |
| **Monday** | After bar stock count, the combined Ordering Run Sheet is generated and sent to Slack | Management / Automatic |
| **Monday** | Ordering is completed by management before 2pm | Management |
| **Tuesday** | Orders arrive | Supplier delivery |
| **Tuesday – Wednesday** | Execute prep tasks from the docs | Bar staff |

**Key rule:** All counting must be done by Sunday evening. If any items have blank counts (not zero — actually blank), the system will flag them and the finalisation will warn about incomplete data.

---

## 3. How to Do the Stocktake (Airtable)

### Opening the Count Sheet

1. Open the Slack app on your phone, computer, or tablet
2. Navigate to the pinned Airtable Interface link — this opens the Weekly Counts page
3. Each item is categorised under its group (House Blend/Syrup, Swizzle, etc.)

### What You Will See

When the week resets on Saturday, you will see **0.00** for every active item.

### How to Count

1. Count as many locations as you can (Bars, CR, B1/2, etc.)
2. Enter the **total volume** for each item
3. When you are happy with your counts, there is nothing further to do on Sunday

### Important

- **Enter a number for every item** — even if the count is zero, leave it as `0`. Do NOT leave it blank. The Saturday reset already sets every item to 0, so you only need to update items that have stock.
- **Units are fixed in the Interface** — you cannot change units from the counting view. If something looks wrong, contact Evan.
- **Count by end of shift Sunday** — the system finalises on Monday AM. Late counts will not be included.

### Common Mistakes

| Mistake | What Happens | How to Avoid |
|---------|-------------|-------------|
| Leaving count blank | System flags the item as incomplete | Always enter a number, even 0 |
| Counting in wrong units | Prep quantities will be wrong | Units are fixed in Interface — contact Evan if wrong |
| Counting after Sunday | Count may not be included in the prep run | Finish by end of shift Sunday |

---

## 4. How to Read the Prep Run Docs

Each Monday morning, two prep docs are created in the shared Drive folder and linked in Slack. A third doc (the ordering sheet) is generated later in the day after the bar stock count. Here is what each one contains.

### Ingredient Prep Run Sheet

This is for **sub-recipes, garnishes, and other prep items** — things that need to be made but are not full batches.

For each item you will see:
- **Item name** (large heading on its own line)
- **"To Make:"** line underneath showing the target quantity in bold, with the buffer amount in brackets (e.g., "To Make: 1000ml (1.5x = 1500ml)")
- **Scale this recipe** link — opens the Recipe Scaler (see Section 5)
- **Ingredients** — bullet list of what you need
- **Method** — how to make it
- **Additional Tasks** — 7 empty checkboxes at the start of the document where you can write in any extra tasks for the week

### Batching Run Sheet

This is for **full batch recipes** — the main production items.

Same layout as above: item name heading, "To Make:" quantity line, ingredients, method, a link to the Recipe Scaler, and an Additional Tasks checkbox section at the end.

### Ordering Run Sheet

This is a single **combined ordering doc** covering both bar stock and prep ingredients. It lists:
- All items grouped by **supplier**
- Supplier email or ordering method (e.g. "Portal or Other")
- Each ingredient with the **quantity needed** plus a **1.5x buffer** amount shown in brackets

**Example:** `Cream 500ml (1.5x = 750ml)` — you need 500ml but order 750ml to allow for buffer.

This doc is generated after the bar stock count is done (separate from the Monday morning prep docs).

### Where to Find the Docs

- **Slack** — check your channel (BM channel, or the general prep channel) for the Monday notification with links
- **Google Drive** — go to the shared Waratah Prep folder: [Google Drive Folder](https://drive.google.com/drive/folders/1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx)

### The "Name" Field

At the top of the Ingredient Prep and Batching docs, there is a **"Name: _______"** line. Write your name here when you start working from the doc so others know who is on it.

---

## 5. How to Use the Recipe Scaler

The Recipe Scaler lets you scale any recipe up or down to a specific quantity. You will find links to it inside the prep docs ("Scale this recipe"), or you can open it directly.

### How to Use It

1. Open the Recipe Scaler (link in the prep doc, or from the Key Links section below)
2. **Select a recipe** from the dropdown — all active recipes are listed
3. **Enter your target quantity** — how much you want to make
4. The scaler shows you the **scaled ingredient list** with adjusted quantities
5. Use the **1.5x buffer toggle** if you want to see buffered quantities

### When to Use It

- When you need to make a different quantity than what the prep doc says
- When you have less or more than the required constituent ingredient
- When you want to double-check ingredient ratios
- When training new staff on recipes

---

## 6. How to Use the Knowledge Platform (AI Chat)

The Knowledge Platform is an AI assistant that can answer questions about recipes, prep procedures, and food science.

**URL:** [Knowledge Platform](https://prep-knowledge-platform.vercel.app/?venue=waratah)

### What It Knows

- All Waratah recipes and their ingredients
- Food science information from the textbook library
- Prep procedures and techniques
- Current stock levels and par information (via Airtable)

### How to Ask Questions

Just type your question in plain English. Examples:
- "Why does citrus curdle dairy in some cocktail specs but not others?"
- "What's the science behind fat-washing spirits?"
- "How do I fix a syrup that's crystallising?"
- "What does saline solution actually do to a drink's flavour?"
- "Why does my oleo saccharum taste bitter instead of bright?"
- "How long can I batch a citrus cordial before it loses its punch?"
- "What's the difference between clarified and super juice for shelf life?"

### What It Cannot Do

- It cannot change Airtable data or modify prep lists
- It cannot place orders
- If a recipe seems wrong, submit feedback instead (see Section 7)

---

## 7. How to Submit Feedback

If you notice something wrong with a recipe, prep doc, or ordering list, submit it through the Feedback Form.

### When to Submit Feedback

- A recipe has incorrect quantities or missing ingredients
- An item is missing from the prep list
- A supplier assignment is wrong on the ordering sheet
- You have a suggestion for improving a recipe or process

### How to Submit

1. Open the Feedback Form (link at the bottom of every prep doc, or from the Key Links section below)
2. Select your **name**
3. Choose the **feedback type** (Recipe Issue, Missing Data, Suggestion, etc.)
4. Select which **document type** it relates to (Batching, Ingredient Prep, Ordering, etc.)
5. **Describe the issue** — be specific (e.g. "Plum Cordial recipe says 200ml honey but should be 600ml")
6. Optionally **search for the recipe or item** using the autocomplete search
7. Submit

### Where Feedback Goes

- Your feedback is saved to Airtable for tracking
- A notification is automatically sent to the prep Slack channel so the team can review it
- The system uses AI to categorise your feedback (Data Fix, Recipe Update, or General) to help prioritise it

---

## 8. Slack Notifications

Every Monday morning when the prep docs are ready, you will receive Slack notifications.

### What You Receive

| Channel | What You Get |
|---------|-------------|
| **Prep channel** | Links to the Ingredient Prep Run Sheet and Batching Run Sheet (Monday AM) |
| **Evan's channel** | Link to the combined Ordering Run Sheet (generated after bar stock count) |

### What the Messages Look Like

Each message contains clickable links to the Google Docs. The doc names include the week-ending date, e.g. "Batching Run Sheet W.E. 09/03/2026".

### Feedback Notifications

When someone submits feedback (see Section 7), a notification also goes to the prep Slack channel with details of what was reported.

---

## 9. Troubleshooting

| Problem | What to Do |
|---------|-----------|
| **I can't find this week's docs** | Check the prep Slack channel for the Monday morning notification. If no notification was sent, check the [Google Drive folder](https://drive.google.com/drive/folders/1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx). If nothing is there, contact Evan. |
| **The counts were not cleared on Saturday** | Contact Evan — the Saturday automation may need to be re-run. |
| **A recipe has wrong quantities** | Submit feedback through the Feedback Form (Section 7). |
| **An item is missing from the prep list** | Check that the item is set to Active in Airtable and has a par level. If it should be there, contact Evan. |
| **The Recipe Scaler shows no recipes** | Check your internet connection. If it persists, contact Evan. |
| **The AI chat gives wrong answers** | The AI works from a knowledge base, not live data. If a recipe is wrong in the system, submit feedback. |
| **I got a Slack notification but the doc links don't work** | Try opening the link in a browser (not the Slack in-app viewer). If still broken, contact Evan. |
| **My ordering doc is missing a supplier** | The ingredient may not have a supplier assigned in Airtable. Check the "NEEDS ASSIGNMENT" section at the bottom of your ordering doc, and contact Evan to fix the assignment. |

---

## 10. Key Links and Contacts

| Resource | Link |
|----------|------|
| **Google Drive Prep Folder** | [Open Folder](https://drive.google.com/drive/folders/1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx) |
| **Knowledge Platform (AI Chat)** | [Open Platform](https://prep-knowledge-platform.vercel.app/?venue=waratah) |
| **Recipe Scaler** | Link in every prep doc ("Scale this recipe"), or ask Evan for the direct URL |
| **Feedback Form** | Link at the bottom of every prep doc, or ask Evan for the direct URL |
| **Airtable Base** | Open the Airtable app and select The Waratah base |

### Contacts

| Who | For What |
|-----|---------|
| **Evan** | System issues, missing data, automation problems, feature requests |

---

*This guide is maintained alongside the PREP system code. If the system changes, this guide will be updated to match.*
