# Welcome Back! Here's the New PREP SYSTEM

Hey! While you were away, we set up a new system to handle all the prep calculations and ordering. Don't worry - it's actually going to make your life easier. This guide will get you up to speed.

---

## The Short Version

**Before:** We figured out what to prep and order manually.

**Now:** You count stock, and the system does the rest - calculates what's short, creates prep lists, and sends everything to Slack.

---

## Your Role: Just Count Stock

The most important thing you need to do is **count stock accurately** on weekends. That's it. The system handles all the maths.

---

## How the Week Works

Here's what happens each week:

```
SATURDAY          SUNDAY            MONDAY MORNING     MONDAY ARVO
   │                 │                    │                 │
   ▼                 ▼                    ▼                 ▼
┌─────────────────────────┐         ┌───────────┐     ┌───────────┐
│   YOU COUNT STOCK       │    →    │  Someone  │  →  │  System   │
│   in Airtable           │         │  clicks   │     │  creates  │
│   (Weekly Counts table) │         │  buttons  │     │  docs &   │
└─────────────────────────┘         └───────────┘     │  sends    │
                                                      │  Slack    │
                                                      └───────────┘
```

### Your Weekend Task: Counting Stock

1. Open **Airtable** (you should have a link bookmarked)
2. Go to the **Weekly Counts** table
3. Find each item and enter how much we have
4. That's it!

Someone else will click the buttons to run the system on Monday.

---

## What Happens on Monday

After your counts are in, the system:

1. Looks at what we have (your stock counts)
2. Compares to what we need (par levels)
3. Calculates the gap
4. Creates prep tasks and ingredient lists
5. Sends everything to Slack

**You don't need to do any of this** - it happens automatically once someone clicks the buttons.

---

## What You'll Get in Slack

Depending on your role, you'll receive different documents:

### If you're on Prep Team:
- **Ingredient Prep List** - What sub-recipes to make
- **Batching List** - What batches to make (with instructions)

### If you're Gooch or Sabs (Ordering):
- **Your Ordering List** - What to order, grouped by supplier

All documents are Google Docs. Click the link in Slack to open them.

---

## Two Handy Tools

### 1. Feedback Button (on every document)

See something wrong? At the top of every prep document, there's a **"Have feedback? Submit here"** link.

Use it when:
- An ingredient is missing
- A quantity looks wrong
- You have a suggestion
- Something doesn't make sense

Your feedback goes straight to the admin team.

### 2. Recipe Scaler (on Batching Lists)

Sometimes you don't have enough of an ingredient to make a full batch. The Recipe Scaler helps you figure out how much you CAN make.

**Example:** Recipe needs 500ml cream, but you only have 200ml. The scaler tells you the adjusted quantities for everything else.

Look for **"Scale this recipe"** link in Batching List documents.

---

## Where to Find Stuff in Airtable

| You want to... | Go to this table |
|----------------|------------------|
| Enter stock counts | **Weekly Counts** |
| See what prep is needed | **Prep Tasks** |
| See ingredient requirements | **Ingredient Requirements** |
| Find the generated docs | **Prep Runs** → click "Link to Prep Guides" |

---

## If Something Goes Wrong

### "I counted something wrong"
No problem - just update it in Weekly Counts. As long as it's before Monday morning when someone clicks "Finalise Count", you're fine.

### "The numbers on my list look off"
The system compares your counts to our par levels. If something seems wrong, check the **Par Levels** table - that's what sets our targets.

### "I didn't get a Slack message"
Ask your manager to check the **Prep Runs** table. There's a field called "Export Request State" - if it says "FAILED", something went wrong and they'll need to sort it out.

### "Can we run it again?"
Yes. Exporting the same prep run again just creates new documents. Nothing breaks.

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────┐
│                    YOUR WEEKLY CHECKLIST                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  WEEKEND:                                                  │
│  □ Count stock                                             │
│  □ Enter counts in Airtable → Weekly Counts                │
│                                                            │
│  MONDAY ONWARDS:                                           │
│  □ Check Slack for your prep list or ordering list         │
│  □ Follow the documents                                    │
│  □ Use feedback link if something's wrong                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Still Confused?

Totally normal - it's new! Here's what to do:

1. **Ask a teammate** who's been using it
2. **Ask your manager** for a quick walkthrough
3. **Read the next level guide:** [Intermediate Guide](README-Level2-Intermediate.md) has more detail

The system looks complicated but your job is simple: **count accurately, and check Slack for your lists**.

---

*Welcome back! You've got this.*
