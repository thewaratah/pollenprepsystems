# Plan: Break Down GoogleDocsPrepSystem.gs (2685 lines → 5 files)

> **Reviewed by:** DHH-style reviewer, Kieran-style reviewer, Code Simplicity reviewer
> **Consensus:** Original 7-file plan was over-engineered. Revised to 5 files, 2 phases, no insert/append dedup.

---

## Context

The Waratah's `GoogleDocsPrepSystem.gs` is a 2685-line monolith. It works, it's production-stable, and it's well-organized with section headers. The problem is purely navigational — it's hard to find what you need in a file this long.

**This is a readability refactor, not a compression exercise.** Total LOC stays roughly the same (~2650 lines across 5 files instead of 1 file). We are NOT trying to reduce line count.

**GAS key insight:** All `.gs` files deploy as ONE global namespace via clasp. Moving a function from FileA.gs to FileB.gs changes nothing at runtime. Zero risk if done as pure cut-and-paste.

---

## File Split (5 files)

| File | ~Lines | What Goes In |
|------|--------|-------------|
| `PrepConfig.gs` | ~160 | `CFG` object + 3 global override vars + file header comment |
| `PrepUtils.gs` | ~320 | Airtable REST API (7 fns) + `getRecipeLinesByRecipeId_` + Drive helpers (3 fns) + all pure utilities (18 fns) + `getOptionalProp_` |
| `PrepDocFormatting.gs` | ~400 | Template engine (7 fns) + formatting helpers (par/stock, feedback, scaler links, bold/underline — all 8 fns) + `appendBullet_` + `appendMultiline_` |
| `PrepDocGenerators.gs` | ~1350 | ALL doc generators — ordering (template + fallback + `buildOrdering_` + `toSupplierBlocks_`) + batching (template + fallback) + ingredient prep (template + fallback) |
| `GoogleDocsPrepSystem.gs` | ~450 | `doGet/doPost` + orchestrator (`exportLatestPrepRunToDocs`) + Slack (6 fns) + poll processor (2 fns) |

No `.claspignore` changes needed — `Prep*.gs` doesn't match any exclusion pattern.

---

## Deduplication: Only 2 Extractions

All three reviewers agreed: do NOT merge insert/append function pairs. "A little duplication is better than the wrong abstraction." The insert/append split reflects a real structural difference (template path vs programmatic fallback).

**Only extract these 2 genuinely duplicated functions:**

1. **`findContentInsertIndex_(body)`** — 8-line block copy-pasted identically 3 times (ordering, batching, ingredient prep template paths). Extract to `PrepDocFormatting.gs`.

2. **`getSubRecipeRequirements_(batch, linesByRecipeId, itemsById, subTasksByItemId)`** — identical function defined twice under two names (`getSubRecipeRequirements` in template path, `getSubRecipeReqs` in fallback). Extract to `PrepDocGenerators.gs` as a top-level function. Note: the extracted version needs those 4 params since it loses closure scope.

**Everything else stays as-is.** `insertParStockLines_` / `appendParStockLines_`, `insertFeedbackLink_` / `appendFeedbackLink_`, inline scaler links, inline method/notes rendering — all stay duplicated. They're short, self-documenting, and each version communicates which code path it belongs to.

---

## Migration (2 phases)

### Phase 1: Cut and paste (zero behavioral change)

1. **Git tag** the current working state: `git tag pre-split-backup`
2. Create `PrepConfig.gs` — cut lines 1-158 (header comment + CFG + globals)
3. Create `PrepUtils.gs` — cut:
   - Airtable core (lines 2291-2398): `getLatestRunWithData_`, `getRunById_`, `airtableGetByIds_`, `airtableListAll_`, `airtableGet_`, `airtablePatch_`
   - Recipe lines (lines 1535-1563): `getRecipeLinesByRecipeId_`
   - Drive helpers (lines 2400-2426): `setRunFolderSharing_`, `trashExistingByName_`, `moveToFolder_`
   - Utilities (lines 2428-2566): all 18 utility functions
   - `getOptionalProp_` (lines 623-627) — moved from template engine section
4. Create `PrepDocFormatting.gs` — cut:
   - Template engine (lines 608-838, minus `getOptionalProp_`): `templateExists_`, `copyTemplate_`, `escapeRegex_`, `replaceAllPlaceholders_`, `cleanupMarkers_`, `removeAllTemplateElements_`, `removeElementsContainingText_`
   - Formatting helpers (lines 1565-1722): all 8 functions
   - `appendBullet_` + `appendMultiline_` (lines 2115-2127)
   - Extract `findContentInsertIndex_(body)` from the 3 duplicated marker-finding blocks
5. Create `PrepDocGenerators.gs` — cut:
   - Ordering doc (lines 841-954): `createOrderingDoc_`, `createOrderingDocFromTemplate_`
   - Batching doc (lines 957-1104): `createBatchingDoc_`, `createBatchingDocFromTemplate_`
   - Ingredient prep doc (lines 1107-1448): `createIngredientPrepDoc_`, `createIngredientPrepDocFromTemplate_`
   - Programmatic fallback batching (lines 1724-1826): `createOrReplaceBatchingDoc_`
   - Programmatic fallback ingredient prep (lines 1828-2128): `createOrReplaceIngredientPrepDoc_`
   - Ordering build + fallback (lines 2129-2289): `buildOrdering_`, `toSupplierBlocks_`, `createOrReplaceOrderingDoc_`
   - Extract `getSubRecipeRequirements_` from the 2 identical nested function definitions
6. `GoogleDocsPrepSystem.gs` now has: `doGet`, `doPost`, `exportPrepRunToDocsForRunId_`, `exportLatestPrepRunToDocs`, `exportLatestPrepRunToDocs_TEST`, Slack (6 fns), poll processor + `safeJson_`

### Phase 2: Deploy and verify

1. `clasp status` — verify all 4 new `Prep*.gs` files listed, no `Waratah_*.gs` files
2. `clasp push --force`
3. Test `?page=scaler` (RecipeScaler resolves `airtableListAll_` from PrepUtils.gs)
4. Test `?page=feedback` (FeedbackForm resolves same)
5. Run `exportLatestPrepRunToDocs_TEST()` from GAS editor
6. Verify all 4 docs generated correctly
7. Verify Slack notifications sent to correct channels
8. Verify poll processor still works

---

## Rules

- **`PrepConfig.gs` must never reference functions from other files at the top level.** CFG initializes with object literals only. The 3 `let` globals initialize to `null`/`false` primitives.
- **No function name may be defined in more than one `.gs` file.** GAS uses last-loaded definition silently.
- **`safeJson_` stays in `GoogleDocsPrepSystem.gs`** — it's only used by the poll processor in the same file.
- **`recordParentBatch_` stays nested inside `exportLatestPrepRunToDocs()`** — it's a nested function, not file-scoped.

---

## Critical Files

| File | Role |
|------|------|
| `The Waratah/scripts/GoogleDocsPrepSystem.gs` | Source file being split |
| `The Waratah/scripts/.claspignore` | Verify new files not excluded |
| `The Waratah/scripts/RecipeScaler.gs` | Depends on `airtableListAll_()` — must work after split |
| `The Waratah/scripts/FeedbackForm.gs` | Same dependency |
| `The Waratah/scripts/Debug.gs` | References CFG + utilities (excluded from deploy) |

---

## Verification Checklist

### Structural
- [ ] `clasp status` shows exactly: `GoogleDocsPrepSystem.gs`, `PrepConfig.gs`, `PrepUtils.gs`, `PrepDocFormatting.gs`, `PrepDocGenerators.gs`, `FeedbackForm.gs`, `FeedbackFormUI.html`, `RecipeScaler.gs`, `RecipeScalerUI.html`, `appsscript.json`
- [ ] No function name defined in more than one `.gs` file
- [ ] No `ReferenceError` in GAS execution logs

### Functional
- [ ] 4 documents generated in correct Drive folder with correct branding
- [ ] Par Level / Stock Counted / Parent Batch QTY lines correct
- [ ] Scaler links present and clickable
- [ ] Feedback links present and clickable
- [ ] Method/Notes sections render correctly
- [ ] Page breaks between items
- [ ] Garnish & Other section in Ingredient Prep doc
- [ ] Ordering docs split correctly by staff (Andie/Blade)
- [ ] Slack notifications to correct channels (Prep, Andie, Blade)
- [ ] Poll processor (`processPrepRunExportRequests`) works via time trigger
- [ ] RecipeScaler web app loads and returns recipe data
- [ ] FeedbackForm web app loads, search + submit works

### Regression
- [ ] Template path tested (with template IDs set)
- [ ] Programmatic fallback tested (temporarily remove template IDs)
- [ ] `debugAirtableConnection()` from Debug.gs works in GAS editor

---

## Rollback Strategy

If anything breaks after `clasp push`:
1. `git checkout pre-split-backup -- "The Waratah/scripts/"`
2. `clasp push --force`

---

## Risks

| Risk | Mitigation |
|------|-----------|
| `const CFG` not visible across files | `const` at file top-level IS project-scoped in GAS (verified: `SCALER_CONFIG` in RecipeScaler.gs works this way) |
| RecipeScaler/FeedbackForm break | Test `?page=scaler` and `?page=feedback` immediately after deploy |
| Duplicate `include()` function in RecipeScaler + FeedbackForm | Pre-existing issue, not introduced by split — note for future cleanup |
| GAS file load order | CFG has zero cross-file dependencies at init time — always safe |
