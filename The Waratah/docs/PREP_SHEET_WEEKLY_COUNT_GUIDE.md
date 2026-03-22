# The Waratah — Prep Sheet & Weekly Count Guide

**Last Updated:** 2026-03-22

This guide explains how to read and use your weekly prep documents. It covers the two main prep sheets, the Recipe Scaler, and the feedback system. If you are new to prep, start here.

---

## What Are Prep Sheets?

*How the system decides what needs to be prepped each week.*

The PREP system tracks a **par level** (target stock quantity) for every item behind the bar. Each week, the system compares your par level against your current stock count to calculate a **shortfall** — the gap between what you have and what you need.

That shortfall gets turned into prep tasks, complete with recipes, ingredients, and quantities. The system then generates two documents for the week:

- **Ingredient Prep Run Sheet** — sub-recipes, garnishes, and other prep items
- **Batching Run Sheet** — full batch recipes (the main production items)

Both documents are created automatically and sent to Slack so you can get started straight away.

---

## The Weekly Prep Cycle

*When prep docs are created and when to execute them.*

Here is the typical weekly timeline:

| When | What happens |
|------|-------------|
| **Sunday** | Stocktake — count current stock levels |
| **Monday AM** | System auto-generates prep docs and posts links to Slack |
| **Monday** | Review the docs, plan your prep work for the week |
| **Tuesday–Wednesday** | Execute prep tasks |

All quantities in the docs include a **1.5x buffer** to account for variance and unexpected demand. For example, if the base shortfall is 1000ml, the doc will show:

> **To Make: 1000ml** (1.5x = 1500ml)

The base quantity is always shown first, with the buffered amount in brackets.

---

## How to Read the Ingredient Prep Run Sheet

*The ingredient prep sheet covers sub-recipes, garnishes, and other prep items — things that need to be made but are not full batches.*

Each item in the Ingredient Prep Run Sheet is laid out in the same order:

1. **Item name** — large heading on its own line so you can find it quickly
2. **"To Make:" line** — target quantity in bold, with the 1.5x buffered quantity in brackets
3. **"Scale this recipe" link** — opens the Recipe Scaler if you need a different quantity (see the Recipe Scaler section below)
4. **Ingredients** — bullet list of everything you need
5. **Method** — step-by-step instructions for making the item
6. **Feedback link** — report any issues with this recipe (wrong quantity, missing ingredient, etc.)

At the very start of the document, before the recipe items, you will find an **Additional Tasks** section with empty checkboxes. Use these for any extra prep tasks that need doing but are not part of the generated recipes.

---

## How to Read the Batching Run Sheet

*The batching sheet lists full batch recipes — the main production items you need to make.*

The Batching Run Sheet follows the same layout as the Ingredient Prep Run Sheet:

1. **Item name** heading
2. **"To Make:" quantity** with buffer
3. **"Scale this recipe" link**
4. **Ingredients** list
5. **Method** steps
6. **Feedback link**

It also has an **Additional Tasks** section with empty checkboxes at the start. The only difference is that this doc contains full-size batch recipes rather than sub-recipes and garnishes.

---

## The "Name" Field

*How to claim a prep doc so others know who is working on it.*

At the top of both the Ingredient Prep and Batching documents, you will see:

> **Name: ___________**

Write your name here when you start working on the document. This lets the rest of the team know who is handling that set of prep tasks and avoids two people working on the same thing.

---

## Using the Recipe Scaler

*How to scale any recipe up or down to a specific quantity.*

The Recipe Scaler is a web tool that adjusts ingredient quantities for any active recipe. Here is how to use it:

1. **Open it** — click the "Scale this recipe" link in any prep doc item, or open it directly from the link in Slack
2. **Select a recipe** — choose from the dropdown (all active recipes are listed)
3. **Enter your target quantity** — type the amount you want to make
4. **View the scaled ingredients** — the tool recalculates every ingredient for your target
5. **Use the 1.5x buffer toggle** — switch this on to see buffered quantities if needed

**When to use the scaler:**

- You need a different quantity than what the doc says
- You want more or less of a particular sub-component
- You are double-checking ingredient ratios
- You are training new staff and want to walk through a recipe at a smaller scale

---

## Submitting Feedback

*How to report recipe issues, missing data, or suggestions.*

**When to submit feedback:**

- A recipe has wrong quantities or missing ingredients
- An item is missing from the prep docs entirely
- A supplier name is wrong or outdated
- You have an idea to improve a recipe or process

**How to submit:**

1. Open the **Feedback Form** — there is a link at the bottom of every recipe in both prep docs
2. Select your **name** from the dropdown
3. Choose the **feedback type** (e.g., recipe issue, missing item, suggestion)
4. Select the **document type** (Ingredient Prep or Batching)
5. **Describe the issue** in the text box
6. Optionally, **search for the specific recipe or item** the feedback relates to
7. Hit **Submit**

**Where feedback goes:** It is saved to Airtable, a notification is posted to Slack, and the system automatically categorises it. Evan reviews all feedback.

---

## Where to Find Prep Docs

*How to access this week's prep documents.*

There are two ways to find your prep docs:

- **Slack** — Monday AM, the system posts a notification with direct links to both documents. This is the quickest way.
- **Google Drive** — All prep docs are stored in the shared Drive folder. Browse to it any time:
  [Waratah Prep Docs Folder](https://drive.google.com/drive/folders/1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx)

If you cannot find the docs in either location, contact Evan.

---

## Common Prep Questions

*Quick answers to things people ask most often.*

**"The quantities seem too high."**
The system applies a 1.5x buffer to every item. The base quantity (what you actually need) is shown first, and the buffered amount is in brackets. Prep to the buffered amount unless told otherwise.

**"I can't find this week's docs."**
Check the Slack channel first — the Monday AM notification has direct links. If there is no notification, check the Google Drive folder linked above. If there is still nothing, contact Evan.

**"A recipe has wrong ingredients."**
Submit feedback using the form link at the bottom of that recipe in the prep doc. Include as much detail as you can (what is wrong, what it should be).

**"I need to make a different quantity."**
Use the "Scale this recipe" link in the prep doc. It opens the Recipe Scaler where you can enter any target quantity and get adjusted ingredients.

**"What if I can't complete all the prep tasks?"**
Do what you can and note what is left. Communicate via Slack so the team knows what still needs doing.

**"The Recipe Scaler shows no recipes."**
Check your internet connection and refresh the page. If the problem persists, contact Evan — the scaler needs an active connection to pull recipe data from Airtable.

---

*Last reviewed: 2026-03-22. For system-level documentation, see the main CLAUDE.md in the project root.*
