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
FRIDAY 8 AM       SATURDAY 8 AM     SATURDAY SHIFT (3:30 PM – 3 AM)
   │                 │                    │
   ▼                 ▼                    ▼
┌───────────┐   ┌───────────┐     ┌──────────────────────────────────┐
│  System   │   │  System   │     │  YOU COUNT STOCK                 │
│  clears   │   │  resets   │     │  in Airtable (Weekly Counts)     │
│  old prep │   │  stocktake│     │                                  │
│  data     │   │  (auto)   │     │  Manager finalises → system      │
│  (auto)   │   └───────────┘     │  creates docs & sends Slack      │
└───────────┘                     │  Ordering also happens now       │
                                  └──────────────────────────────────┘
```

### Your Saturday Shift Task: Counting Stock

1. Open **Airtable** and go to the **Stock Count Interface** (you should have a link bookmarked)
2. The Interface gives you a clean list of items to count — no need to navigate raw tables
3. Find each item and enter how much we have
4. That's it!

The manager will finalise the count and run the system during the same Saturday shift.

---

## What Happens After You Count

Once the team finishes counting during Saturday shift, the manager runs the system:

1. Finalises your stock counts (locks them in)
2. Compares what we have to what we need (par levels)
3. Calculates the gap
4. Creates prep tasks and ingredient lists
5. Exports everything to Google Docs and sends Slack notifications

**You don't need to do any of this** — the manager handles it during the Saturday shift. By Sunday morning, all lists are ready.

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

*These are built into your prep documents to help you on the spot.*

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

*You'll use the Airtable Interface for almost everything — it's a clean dashboard, not the raw tables.*

| You want to... | Where to go |
|----------------|-------------|
| Enter stock counts | **Stock Count Interface** (your main dashboard) |
| See what prep is needed | Check Slack for your lists, or the Interface |
| See ingredient requirements | Check Slack, or the Interface |
| Find the generated docs | Slack messages have direct links; also available in the Interface |

---

## If Something Goes Wrong

*Common hiccups and how to fix them quickly.*

### "I counted something wrong"
No problem — just update it in the Stock Count Interface. As long as it's before the manager clicks "Finalise Count" during Saturday shift, you're fine.

### "The numbers on my list look off"
The system compares your counts to our par levels. If something seems wrong, ask your manager to check the par level settings — those set our targets.

### "I didn't get a Slack message"
Ask your manager to check the export status in the Interface. If it shows "FAILED", something went wrong and they'll need to sort it out.

### "Can we run it again?"
Yes. Exporting the same prep run again just creates new documents. Nothing breaks.

---

## Quick Reference Card

*Print this out or screenshot it for your first week.*

```
┌────────────────────────────────────────────────────────────┐
│                    YOUR WEEKLY CHECKLIST                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SATURDAY SHIFT:                                           │
│  □ Count stock                                             │
│  □ Enter counts via the Airtable Interface                  │
│                                                            │
│  SATURDAY NIGHT / SUNDAY:                                  │
│  □ Check Slack for your prep list or ordering list         │
│                                                            │
│  TUESDAY–WEDNESDAY:                                        │
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
3. **Read the next level guide:** [Manager Guide](MANAGER_GUIDE.md) has more detail

The system looks complicated but your job is simple: **count accurately, and check Slack for your lists**.

---

*Welcome back! You've got this.*
