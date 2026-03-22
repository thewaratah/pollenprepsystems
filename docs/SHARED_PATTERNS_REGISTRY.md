# Shared Patterns Registry

**Purpose:** Single source of truth for which files must stay synchronized between Sakura House and The Waratah. Used by `parity-check-agent` to detect missing backports.

**Last Updated:** 2026-03-23

---

## Tier 1 — Identical Logic

These file pairs share the same algorithm. Differences should only be venue-specific substitutions (staff names, field names, base IDs). Any bug fix or pattern improvement in one must be backported to the other.

| Sakura File | Waratah File | Shared Functions | Known Divergences |
|-------------|-------------|------------------|-------------------|
| `ClearWeeklyCount.gs` | `Waratah_ClearWeeklyCount.gs` | `formatSydneyTimestamp_`, `safeGetTable_`, `batchDelete_`, `batchCreate_`, `getUserFromModifiedRecords_`, `writeAuditLog_`, core `main()` flow | Waratah has `addMissingOnly` mode, `countStaffField` default "Blade"; Sakura does not |
| `FinaliseCount.gs` | `Waratah_FinaliseCount.gs` | Same 6 utilities + validation flow | Waratah uses `Item Name` linked record for recipe validation; Sakura uses `Recipe Name` text |
| `GeneratePrepRun.gs` | `Waratah_GeneratePrepRun.gs` | Same utilities + shortfall calculation, batching, two-pass sub-recipe cascade | Waratah has `Ordering Staff (Static)` on Ingredient Requirements; different `allowedTopLevelItemTypes` sets |
| `FeedbackForm.gs` | `FeedbackForm.gs` | Entire file structure, AI triage, Slack notification | Waratah: `Item Name` linked-record search, different Slack webhook props, different `docTypes`/`staffRoles` |
| `FeedbackFormUI.html` | `FeedbackFormUI.html` | Entire UI | Title text only |
| `RecipeScalerUI.html` | `RecipeScalerUI.html` | Entire UI | Title text, brand colors |

### 8 Duplicated Utility Functions

These functions are copy-pasted identically in every Airtable automation script (unavoidable — Airtable has no shared module system). A fix to any copy must be propagated to all copies.

| Function | Copies | Where |
|----------|--------|-------|
| `formatSydneyTimestamp_()` | ~10 | All Airtable scripts (both venues) |
| `safeGetTable_()` | ~10 | All Airtable scripts |
| `safeField_()` | ~8 | Most Airtable scripts |
| `writeAuditLog_()` | ~10 | All Airtable scripts |
| `batchCreate_()` | ~8 | Scripts that create records |
| `batchDelete_()` | ~8 | Scripts that delete records |
| `batchUpdate_()` | ~6 | Scripts that update records |
| `getUserFromModifiedRecords_()` | ~8 | Scripts with audit logging |

---

## Tier 2 — Parallel Logic

Same algorithm but venue-specific implementations. Changes to shared patterns (error handling, credential access, doc formatting) must be applied to both. Venue-specific logic (recipe name resolution, staff routing) diverges intentionally.

| Sakura File | Waratah File | What Must Stay Aligned | What Diverges Intentionally |
|-------------|-------------|------------------------|----------------------------|
| `GoogleDocsPrepSystem.gs` | `GoogleDocsPrepSystem.gs` | `clearContent()` usage, credential access via Script Properties, error handling, Slack notification patterns, hybrid template engine v4.2, `chunk_()`, Airtable REST helpers | Recipe name resolution, staff names, template IDs, ordering doc structure (Sakura: 2 per-staff; Waratah: 1 combined), number of output docs |
| `RecipeScaler.gs` | `RecipeScaler.gs` | `muteHttpExceptions`, active-item filtering, error handling, scaling algorithm | Recipe name field (`Recipe Name` text vs `Item Name` linked record), web app URL |
| `GeneratePrepSheet.gs` | `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` | Export request state machine (`REQUESTED` → `DONE`/`ERROR`) | Trigger mechanism (single-record vs polling), date guard |
| `deploy-docs-to-drive.js` | `deploy-docs-to-drive.js` | Core conversion logic (`convertMarkdownToDocx`, `uploadToFolder`, `main`) | Folder IDs, file lists, labels |

---

## Tier 3 — Venue-Specific (No Parity Needed)

| Venue | Files | Why No Counterpart |
|-------|-------|-------------------|
| Waratah | `Waratah_InitStockCount.gs`, `Waratah_CompleteStockCount.gs`, `Waratah_ValidateStockCount.gs`, `Waratah_GenerateStockOrders.gs`, `Waratah_ExportOrderingDoc.gs` | Stock count/ordering pipeline — Sakura has no equivalent |
| Sakura | `ClearPrepData.gs` | Friday AM cleanup — Waratah uses `InitStockCount` instead |
| Sakura | `GoogleDocsPrepSystem_TestHarness.gs` | Test harness — Waratah equivalent planned but not yet created |
| Waratah | `Debug.gs` | Debug utility — excluded from deployment |

---

## Venue-Specific Divergence Map

These differences are **intentional** and must NOT be synchronized. The `parity-check-agent` ignores these.

| Concern | Sakura Value | Waratah Value |
|---------|-------------|---------------|
| Recipe name field | `Recipe Name` (plain text) | `Item Name` (linked record → Items table) |
| Ordering staff | Gooch, Sabs | Andie, Blade |
| Airtable base ID | `appNsFRhuU47e9qlR` | `appfcy14ZikhKZnRS` |
| Script prefix | None | `Waratah_` for Airtable scripts |
| Slack webhook props | `SLACK_WEBHOOK_GOOCH`, `_SABS`, `_KALISHA`, `_EVAN` | `SLACK_WEBHOOK_PREP`, `_WARATAH_PREP`, `_WARATAH_TEST` |
| Weekly cycle | Fri clear → Sat reset → Sat shift | Sun stocktake → Mon automation |
| Output docs | 4 per run (2 ordering + batching + ingredient prep) | 2 prep docs + 1 combined ordering (separate trigger) |
| Brand colors | TBD | `#4A5D23` (primary), `#2D3A16` (secondary) |
| Item type variants | Standard set | Must include `"Batch"`, `"Sub Recipe"`, `"Sub-recipe"` |

---

## How to Use This Registry

1. **Before fixing a bug:** Check if the affected file has a counterpart in this registry
2. **After fixing:** Run `/parity` to verify the counterpart is aligned
3. **When adding features:** If the feature applies to both venues, add it to both and update this registry
4. **Utility function changes:** Must be propagated to ALL copies listed above
