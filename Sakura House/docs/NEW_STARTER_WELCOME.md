# Welcome to the Sakura House PREP System

This guide gives you everything you need to know about our prep system. It's written for new staff — no technical knowledge required.

---

## What Is the PREP System?

The PREP system automates how we figure out what to prep and order each week. Instead of manually calculating shortfalls and writing lists, the system does it for you.

**You count stock. The system does the maths.**

---

## How Your Week Works

*A quick overview of the weekly cycle from Saturday to Friday.*

| When | What Happens | Who Does It |
|------|-------------|-------------|
| **Friday 8 AM** | System clears old prep data | Automatic (scheduled) |
| **Saturday 8 AM** | System resets the stocktake | Automatic (scheduled) |
| **Saturday shift** | You count stock in Airtable | You and the team |
| **Saturday shift** | Manager finalises, generates lists, exports to Slack | Manager runs the system |
| **Saturday shift** | Ordering is done | Gooch and Sabs |
| **Sunday–Monday** | Orders arrive, any extra ordering | Suppliers / team |
| **Tuesday–Wednesday** | Prep is done, remaining orders arrive | You follow the lists |

That's the whole cycle. It repeats every week.

---

## Your Daily Responsibilities

*What you need to do each day, depending on your role.*

### If You're on Prep Team

Here's your typical week on prep.

1. **Saturday shift:** Count stock using the Airtable Interface (a clean dashboard — not the raw tables)
2. **Saturday night / Sunday:** Check Slack for your lists:
   - **Ingredient Prep List** — Sub-recipes to make first
   - **Batching List** — Batches to make (with full recipes and quantities)
3. **Tuesday–Wednesday:** Follow the documents. They tell you exactly what to make and how much.

### If You're Gooch or Sabs (Ordering)

Here's your typical week on ordering.

1. **Saturday shift:** Help count stock
2. **Saturday shift:** Check Slack for your **Ordering List** — items grouped by supplier
3. Place orders during Saturday shift (orders arrive Sunday–Wednesday)

---

## How to Count Stock

*Your step-by-step guide to the weekend stocktake.*

1. Open **Airtable** and go to the **Stock Count Interface** (you should have a link bookmarked)
2. The Interface shows you a clean list of items to count — no need to navigate raw tables
3. For each item, enter the quantity you counted
4. Make sure you count accurately — the system uses your numbers to calculate everything

**Tip:** Count during Saturday shift. The manager finalises the count that same shift, which locks in your numbers.

---

## What the Documents Look Like

*What to expect when you open the prep docs from Slack.*

Every document is a Google Doc. You'll get a Slack message with a link — just click it.

### Batching List
Shows each batch to make:
- **What:** Item name and how many batches
- **Ingredients:** Everything you need with quantities
- **Method:** Step-by-step instructions
- **Quantities show two numbers:** The base amount and the buffered amount (1.5x safety margin)

### Ingredient Prep List
Shows sub-recipes to prepare before batching:
- Grouped by which batch needs them
- Tells you what to make and how much

### Ordering Lists (Gooch / Sabs)
Shows items to order:
- Grouped by supplier
- Includes quantities needed
- One list per ordering person

---

## Two Useful Tools

*Built-in helpers you can use from any prep document.*

### 1. Feedback Button

Report issues or suggest improvements directly from a document.

Every document has a **"Have feedback? Submit here"** link at the top.

Use it when:
- An ingredient is missing from a list
- A quantity looks wrong
- You have a suggestion for improvement

Your feedback goes to the admin team and gets auto-categorised.

### 2. Recipe Scaler

Adjust recipe quantities when you're short on an ingredient.

Found on Batching List documents — look for **"Scale this recipe"**.

Use it when you don't have enough of one ingredient to make a full batch. Tell it what you have, and it calculates adjusted quantities for everything else.

**Example:** Recipe needs 500ml cream but you only have 200ml. The scaler tells you how much of everything else to use.

---

## Where to Find Things in Airtable

*Quick reference — you'll use the Interfaces for almost everything.*

Staff interact with the system through **Airtable Interfaces** — purpose-built dashboards with buttons and filtered views. You don't need to open raw tables.

| You want to... | Where to go |
|----------------|-------------|
| Enter stock counts | **Stock Count Interface** (your main dashboard) |
| See what prep is needed | **Prep Tasks** view in the Interface |
| See ingredient requirements | **Ingredient Requirements** view in the Interface |
| Find generated documents | Check Slack, or find the link in the Interface |
| Check par levels (targets) | Ask your manager (Par Levels table is admin-level) |
| Look up a recipe | Ask your manager or check the Batching List document |

---

## Common Questions

*Answers to the things new starters ask most often.*

### "I counted something wrong"
Update it in the Stock Count Interface before the manager finalises the count during Saturday shift. After that, the system locks the numbers.

### "The quantities on my list look off"
The system compares your counts against par levels. Ask your manager to check the par level settings — those set the targets.

### "I didn't get a Slack message"
Ask your manager. They can check the export status in the Interface — if it shows "FAILED", something went wrong.

### "Can we run the export again?"
Yes. Re-exporting just creates new documents. Nothing breaks.

### "What's the 1.5x number?"
That's a safety buffer. The system suggests 50% more than the exact calculation to account for waste, mistakes, and variance.

---

## Document Guide

*Other guides available if you need more detail.*

| Guide | What It Covers | Who It's For |
|-------|---------------|-------------|
| **This document** | System overview, daily workflow | New starters |
| [Staff Guide](STAFF_GUIDE.md) | Detailed stocktake process | All staff |
| [Manager Guide](MANAGER_GUIDE.md) | Configuration, troubleshooting, adding items | Managers |
| [Technical Reference](TECHNICAL_REFERENCE.md) | Script internals, deployment, algorithms | Developers |
| [Airtable Schema](AIRTABLE_SCHEMA.md) | All table and field definitions | Developers / managers |

---

## Key People

*Who to ask when you need help.*

| Role | Person | What They Handle |
|------|--------|-----------------|
| Ordering | **Gooch** | Orders from Gooch's assigned suppliers |
| Ordering | **Sabs** | Orders from Sabs' assigned suppliers |
| System admin | Your manager | Runs the weekly cycle, adjusts par levels |

---

*Questions? Ask your manager or use the feedback link on any document.*
