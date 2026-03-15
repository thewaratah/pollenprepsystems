# Negligible Stock Decrements — Design

**Date:** 2026-02-20
**Status:** Ready for implementation

---

## Overview

Add a "Negligible Stock Decrements" section to the bottom of each ordering Google Doc (Gooch and Sabs). This section surfaces items where usage is so small relative to the unit purchase size that stock on hand is likely sufficient — prompting staff to verify before ordering rather than ordering automatically.

---

## 1. Data Layer

Two lookup fields have been added to the `Ingredient Requirements` Airtable table, pulling from the linked Item record:

| Field | Type | Source |
|-------|------|--------|
| `Order Size (Lookup)` | Number | `Items.Order Size` |
| `Unit (Lookup)` | Text | `Items.Unit` |

No script query changes required — these fields are returned automatically with existing `Ingredient Requirements` fetches.

---

## 2. Filtering Logic

In `GoogleDocsPrepSystem.gs`, after fetching ingredient requirements for a prep run, split each staff member's requirements into two buckets before building the document:

```javascript
const ratio = orderSize > 0 ? totalQtyNeeded / orderSize : Infinity;
const isNegligible = ratio <= 0.05; // 5% threshold
```

| Condition | Bucket |
|-----------|--------|
| `ratio ≤ 5%` | `negligible[]` |
| `ratio > 5%` | `normal[]` |
| `Order Size` is null, 0, or blank | `normal[]` (safe default — can't evaluate) |

- `normal[]` items flow through existing supplier-grouping logic unchanged
- `negligible[]` items skip the main supplier grouping and feed the new section

---

## 3. Document Generation

### Position
Appended after all existing supplier sections in each ordering doc (Gooch and Sabs independently).

### Structure

```
NEGLIGIBLE STOCK DECREMENTS
Likely have stock on hand. VERIFY BEFORE ORDERING

[Supplier Name]
• Roku Gin          35ml needed / 700ml unit = 5.0%
• Truffle Oil        8ml needed / 250ml unit = 3.2%

[Another Supplier]
• Sichuan Pepper     2g needed / 100g unit = 2.0%
```

### Formatting Rules

| Element | Style |
|---------|-------|
| "NEGLIGIBLE STOCK DECREMENTS" heading | Same style as existing supplier headings |
| "Likely have stock on hand. VERIFY BEFORE ORDERING" | Italic subheading |
| Supplier subheadings within section | Same style as existing supplier headings |
| Item bullets | `• Item Name    Xunit needed / Yunit unit = Z%` |
| Ratio format | 1 decimal place (e.g., `5.0%`, `3.2%`) |

### Edge Cases

- If a staff member has **no negligible items**, the entire section is omitted (no empty heading)
- Items with missing `Order Size` never appear here — they remain in the main list
- Per-staff filtering applies: Gooch and Sabs each only see their own items in this section

---

## 4. Files to Change

| File | Change |
|------|--------|
| `scripts/GoogleDocsPrepSystem.gs` | Add filtering logic + section rendering |

No Airtable schema changes required (lookup fields already added).
No new documents created — this is a section appended to existing docs.

---

## 5. Threshold

| Setting | Value |
|---------|-------|
| Negligible ratio | ≤ 5% (`Total Qty Needed / Order Size`) |

This threshold can be adjusted as a named constant in the script for easy future tuning.
