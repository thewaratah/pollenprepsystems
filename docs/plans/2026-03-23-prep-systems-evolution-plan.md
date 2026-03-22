# PREP Systems Evolution Plan

**Created:** 2026-03-23
**Deepened:** 2026-03-23 (12 specialist agents)
**Status:** Deepened — Ready for Review
**System:** Multi-venue kitchen prep automation (Airtable + GAS + Google Docs + Slack)
**Venues:** Sakura House, The Waratah

---

## Enhancement Summary

**Sections enhanced:** All 4 phases + new items added
**Research agents used:** Architect, Performance Oracle, Security Sentinel, Simplicity Reviewer, Pattern Recognition, Architecture Strategist, Slack Expert, JavaScript Pro, Data Analyst, Workflow Orchestrator, Best Practices Researcher, Product Manager

### Key Changes from Deepening
1. **Phase 3 eliminated** — All 12 agents agreed: premature for 2 venues/10 users. No venue #3 planned.
2. **Phase 4 dissolved** — Items redistributed into Phases 1-2 where they serve.
3. **Phase 1 tightened** — Items 1.3 and 1.6 dropped. Two new critical items added (trigger budget audit, error classification).
4. **Phase 2 restructured** — Items 2.3 and 2.4 deferred pending user validation. Self-healing polling drastically simplified.
5. **New constraint discovered** — 100 UrlFetchApp calls per GAS execution is the binding limit (not the 6-min time limit).
6. **New critical gap** — 20-trigger cap for GAS must be audited before adding any features.
7. **Bus factor identified as #1 strategic risk** — Single developer (Evan) manages everything. Runbook + backup operator recommended (Architecture Strategist).
8. **Supplier email integration promoted** — Moved from Phase 3 to "next high-value feature" after Phase 2. Saves ~100 manual emails/year across 2 venues (Architecture Strategist).

### Agent Consensus Matrix

| Topic | Simplicity | Architect | Performance | Product | Security |
|-------|-----------|-----------|-------------|---------|----------|
| Phase 1 core (1.1, 1.2, 1.4) | KEEP | KEEP | KEEP | KEEP | KEEP |
| Phase 1.3 (Test protocol) | DEFER | KEEP | — | — | — |
| Phase 1.6 (Magic numbers) | DROP | KEEP | — | — | — |
| Phase 2.1 (Predictive par) | CUT | KEEP | CAUTION | VALIDATE | — |
| Phase 2.2 (Self-healing) | SIMPLIFY | KEEP | KEEP | CONDITIONAL | CAUTION |
| Phase 2.3 (Feedback loop) | CUT | DEFER | — | VALIDATE | — |
| Phase 2.4 (Analytics) | CUT | DEFER | HIGH RISK | CUT | — |
| Phase 3 (all items) | CUT ALL | DE-RISK | — | CUT ALL | CAUTION |
| Phase 4 (agent pipeline) | CUT ALL | REDISTRIBUTE | — | DEFER | — |

---

## Overview / Problem Statement

PREP Systems is a production-ready multi-venue kitchen/bar prep automation platform built on Airtable + Google Apps Script + Google Docs + Slack. The system scores A- overall (8.5/10 code quality) with exceptional architecture, security, and credential management. However, several areas need improvement:

1. **Code duplication** — Utility functions duplicated across 9+ Airtable scripts; recipe resolution duplicated 3x per venue
2. **No API resilience** — Airtable API calls lack rate-limit handling (429 → immediate failure)
3. **Dead code** — Deprecated fallback doc generators still present in PrepDocGenerators.gs
4. **Limited test integration** — Test harnesses exist but not linked to deployment workflow
5. **No error classification** — HTTP errors are not categorized (transient vs permanent vs rate-limit)

### Research Insights: What NOT to Fix

The following items from the original plan were evaluated and **intentionally excluded** based on multi-agent consensus:

- **Static par levels** — Not a validated pain point. Staff may be tuning par levels fine manually. Validate with user interviews first (Product Manager).
- **Polling latency** — 2-minute delay is acceptable for weekly prep cycles. Webhooks add complexity for marginal gain (Simplicity, Architect).
- **Manual Airtable deployment** — This is an Airtable platform constraint, not a system bug (Architect).
- **Large file complexity** — Commit `b3b07cb` already split GoogleDocsPrepSystem.gs into 5 files. Verify current state before assuming this is still an issue (Simplicity).

---

## Phase 0: Immediate Security Fixes (Before Anything Else)

**Discovered by Security Sentinel during plan deepening. Fix before starting Phase 1.**

### 0.1 Backport XSS Fix to Sakura RecipeScalerUI.html

**Severity:** MEDIUM — Waratah was fixed 2026-03-03 but Sakura was missed.

Sakura's `RecipeScalerUI.html` renders `ing.name`, `ing.unit`, and `ing.originalQty` directly into innerHTML without escaping. An item name containing `<script>` or `<img onerror=...>` would execute in the user's browser.

**Fix:** Copy `escapeHtml()` function from Waratah's RecipeScalerUI.html to Sakura's, and apply it to all interpolated values. This is a parity backport — run `/parity RecipeScalerUI.html` after.

### 0.2 Sanitize doPost() Error Responses

**Severity:** LOW — Full error messages (including Airtable base IDs, table names) are returned to anonymous callers via doPost().

**Fix:** Return generic error message to external callers, log details internally:
```javascript
Logger.log('doPost error: ' + (err.message || err));
return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Internal error' }));
```

### 0.3 Sakura Slack Notification Abort Bug (P1 — from Slack Expert)

**Severity:** P1 — If any single webhook POST throws in Sakura's `postPrepRunToSlack_`, all remaining recipients are never notified.

**Fix:** Replace `postToSlack_()` with `tryPostToSlack_()` inside the webhook loop so a single channel failure doesn't abort the remaining 4 channels:
```javascript
// In Sakura GoogleDocsPrepSystem.gs — change:
postToSlack_(getSlackWebhook_(prop), text);
// To:
tryPostToSlack_(getSlackWebhook_(prop), text, prop);
```

### 0.4 Additional Findings (Low Priority)

- **XFrameOptions ALLOWALL** on RecipeScaler and FeedbackForm web apps — allows iframe embedding/clickjacking. Change to `HtmlService.XFrameOptionsMode.DEFAULT` unless embedding is required.
- **Slack @channel injection** — User-supplied feedback descriptions are interpolated into Slack mrkdwn without stripping `@here`/`@channel`/`@everyone`. Strip these before sending.
- **Missing `text` fallback key** in FeedbackForm Block Kit payloads (both venues) — Slack push notifications show "sent an attachment" instead of a preview. Add `text: "New prep feedback from ..."` alongside `blocks`.
- **Health check email fallback** — If Slack is down, health alerts are lost. Add `GmailApp.sendEmail()` fallback using a `HEALTH_ALERT_EMAIL` Script Property. GmailApp requires no additional OAuth.

---

## Phase 1: Consolidate & Harden

**Goal:** Eliminate duplication, add resilience, close critical gaps.
**Effort:** ~2-3 days of focused work.
**Risk:** Low — all changes are localized.

### 1.1 Extract Recipe Resolution + Add API Retry (Merged)

**Problem:** Recipe name resolution duplicated 3x per venue (~40 lines each). Airtable API calls crash immediately on HTTP 429.

**Solution (two changes in one PR):**

**A) Recipe resolution utility in PrepUtils.gs:**
```javascript
// New function — Sakura is pass-through, Waratah resolves linked records
function resolveRecipeName_(recipe, itemsById) {
  const linked = recipe.fields['Item Name'];
  if (!linked || !linked.length) return recipe.fields['Recipe Name'] || '(Unknown)';
  const itemId = typeof linked[0] === 'object' ? linked[0].id : linked[0];
  const item = itemsById[itemId];
  return item ? (item.fields['Item Name'] || item.fields['Name'] || '(Unknown)') : '(Unknown)';
}
```

**B) Retry with backoff in airtableGet_():**
```javascript
function airtableGet_(table, params) {
  const MAX_RETRIES = 2; // Only 2 retries — 429 requires 30s wait each
  const url = /* ... existing URL construction ... */;
  const options = /* ... existing options ... */;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = UrlFetchApp.fetch(url, options);
    const code = resp.getResponseCode();
    if (code === 429 && attempt < MAX_RETRIES) {
      // CRITICAL: Airtable mandates 30-second wait after 429 (not 1-4s!)
      const delay = 30000 + (attempt * 5000); // 30s, then 35s
      Logger.log('Rate limited (429). Waiting %ss before retry %s', delay/1000, attempt + 1);
      Utilities.sleep(delay);
      continue;
    }
    if (code >= 500 && attempt < MAX_RETRIES) {
      // Server errors: exponential backoff with jitter
      const delay = Math.pow(2, attempt) * 1000 * (0.5 + Math.random());
      Logger.log('Server error (%s). Retry %s in %sms', code, attempt + 1, Math.round(delay));
      Utilities.sleep(delay);
      continue;
    }
    if (code < 200 || code >= 300) throw new Error(/* ... existing error ... */);
    return JSON.parse(resp.getContentText());
  }
}
```

**IMPORTANT (Best Practices Researcher):** Airtable's 429 response requires a **30-second wait**, not the typical 1-4 seconds used by most APIs. With 2 retries at 30s+ each, a worst-case 429 scenario adds ~65 seconds to execution. This is acceptable within the 6-minute GAS limit but means retry count should be capped at 2 (not 3) to avoid approaching the limit.

**Files affected:**
- `PrepUtils.gs` (both venues) — add utility + modify `airtableGet_()`
- `RecipeScaler.gs` (both venues) — replace inline resolution
- `FeedbackForm.gs` (both venues) — replace inline resolution

### Research Insights (Performance Oracle)

- **Also apply retry to `airtablePatch_()`** — PATCH calls to update export state are equally vulnerable to 429s. A failed state update leaves a record stuck in REQUESTED permanently.
- **Cap total retry time per execution** — Track cumulative retry delay. If total backoff exceeds 30 seconds across all calls in one execution, fail fast rather than hitting the 6-min limit.
- **Add jitter** (included above) — Pure exponential creates thundering-herd if both venues trigger simultaneously.
- **100-fetch limit is the real constraint** — GAS allows only 100 `UrlFetchApp.fetch()` calls per execution. This matters more than the 6-minute time limit for API-heavy operations.

### Research Insights (Architect)

- **Error classification** — Classify HTTP errors: 4xx = permanent (don't retry), 5xx = transient (retry), 429 = rate limit (retry with 30s backoff). The current code treats all non-2xx as the same.

### Research Insights (Best Practices Researcher)

- **Inter-request throttling** — Add `Utilities.sleep(200)` between sequential Airtable calls in loops to stay comfortably under 5/sec. Sakura's `GoogleDocsPrepSystem.gs` already does `Utilities.sleep(250)` for Slack posts — the same pattern should apply to Airtable call loops.
- **Batch writes** — Airtable supports up to 10 records per create/update/delete. Ensure `batchCreate_` and `batchUpdate_` in Airtable scripts use batches of 10 (some currently use 50, which requires 5 sequential API calls per batch).
- **CacheService for repeated reads** — Cache the Items table and Recipes table at the start of each export run using `CacheService.getScriptCache()` with 1-hour TTL. These tables are read multiple times across 2-3 doc generation functions within a single run.

---

### 1.2 Delete Dead Fallback Doc Generators

**Problem:** Programmatic-only doc generators (`createOrReplaceXxxDoc_`) still exist. Templates are standard since v4.2.

**Solution:** Remove fallback functions from PrepDocGenerators.gs in both venues. ~30 minutes of work.

**Files affected:**
- `PrepDocGenerators.gs` (both venues)

### Research Insights (Simplicity)

- This is dead code that misleads readers and creates false search results. Delete it. If templates ever fail, the system should error loudly — not silently fall back to a deprecated code path.

---

### 1.3 Verify PrepDocGenerators Split Status (NEW — was 1.5)

**Problem:** Commit `b3b07cb` ("Split GoogleDocsPrepSystem.gs monolith into 5 files") may have already addressed this.

**Action:** Check current file sizes. If PrepDocGenerators.gs is already split or reasonable, close this item. If still >40KB, complete the split.

**This is a verification, not a task.** 5 minutes.

---

### 1.4 Audit GAS Trigger Budget (NEW — from Architect)

**Problem:** GAS has a hard 20-trigger limit per project. The plan proposes adding 3-5 new triggers across phases. Current trigger usage is unknown.

**Solution:**
1. Run `ScriptApp.getProjectTriggers().length` on both venue GAS projects
2. Document current trigger inventory (function name, frequency, type)
3. Calculate remaining headroom
4. If <5 slots remaining, consolidate triggers (one "weekly maintenance" trigger that dispatches multiple functions)

**This gates all Phase 2 work.**

### Research Insights (Architect)

- Current system has at minimum: `processPrepRunExportRequests` (every 2 min), `processOrderingExportRequests` (every 2 min), `healthCheck` (every 30 min). That's 3 known triggers. But there may be more from GAS editor manual additions.
- Each new feature (predictive par, analytics, feedback digest) adds 1 trigger. Budget carefully.

---

### 1.5 Standardize Error Handling (NEW — from Architect)

**Problem:** No structured error classification. All HTTP errors are treated the same. No error reporting pipeline beyond console logging.

**Solution:** Add error classification to `airtableGet_()`:
```javascript
// Error classification (add to airtableGet_ retry logic)
if (code >= 400 && code < 500 && code !== 429) {
  // Client error (permanent) — don't retry, log to Audit Log
  throw new AirtableClientError(code, resp.getContentText());
}
if (code >= 500) {
  // Server error (transient) — retry if attempts remain
}
if (code === 429) {
  // Rate limit — retry with backoff (existing logic)
}
```

**Files affected:**
- `PrepUtils.gs` (both venues) — enhance error handling in API layer

---

### 1.6 Add IN_PROGRESS State to Ordering Export (NEW — from Workflow Orchestrator)

**Problem:** The ordering export state machine jumps from REQUESTED directly to COMPLETED/ERROR with no intermediate state. healthCheck() cannot distinguish "currently processing" from "waiting to be processed", making stall detection ambiguous.

**Solution (3-line change):** In `processOrderingExportRequests()`, patch the session's `Ordering Export State` to "IN_PROGRESS" before calling `exportCombinedOrderingDoc_()`. The prep run export already does this correctly — this is a parity fix.

```javascript
// Before calling export — add this:
airtablePatch_(countSessionsTable, session.id, { 'Ordering Export State': 'IN_PROGRESS' });
```

**Files affected:**
- `GoogleDocsPrepSystem.gs` (Waratah) — add 1 patch call before export
- Airtable: Add "IN_PROGRESS" option to "Ordering Export State" single-select field

### Research Insights (Workflow Orchestrator)

- **No saga orchestrator needed.** The current "choreography with guardrails" pattern (each script checks its own preconditions) is correct for a fixed-sequence weekly workflow with no conditional branching.
- **Workflow progress view** — Consider a single "Weekly Progress" Airtable view showing where this week's cycle is (which steps completed, which pending). Low effort, high visibility for Evan.
- **Concurrent exports handled correctly** — `LockService.getScriptLock()` with 30-second timeout already prevents duplicate processing. FIFO ordering within a single lock-protected execution is correct.

---

### Phase 1 Acceptance Criteria

- [ ] Recipe resolution utility extracted; all callers use it; no inline duplication
- [ ] Airtable API retries working with jitter; 429 and 5xx handled; `airtablePatch_` included
- [ ] Fallback doc generators deleted from both venues
- [ ] PrepDocGenerators split verified (or completed if needed)
- [ ] GAS trigger budget audited and documented for both venues
- [ ] Error classification added (4xx/5xx/429 distinct handling)
- [ ] Ordering export has IN_PROGRESS state (parity with prep run export)
- [ ] FeedbackForm.gs + RecipeScaler.gs use `getAirtableBaseId_()`/`getAirtablePat_()` instead of raw `props.getProperty()` (JavaScript Pro — P1 credential validation bypass)
- [ ] healthCheck ordering stall detection checks age (not just existence) of REQUESTED sessions

---

## Phase 2: Reliability & Validated Intelligence

**Goal:** Improve system reliability. Add intelligence features ONLY after user validation.
**Effort:** 2-4 weeks, conditional on validation results.
**Risk:** Medium — requires user interviews before building 2.2 and 2.3.

### GATE: User Validation (Before Starting Phase 2)

**This is mandatory. Do not skip.**

Before building any Phase 2 items, collect answers to these questions (Product Manager):

1. **Par levels:** Have Gooch, Sabs, Andie, or Blade ever said "par levels are wrong" or "I wish the system suggested par levels"?
2. **Feedback form usage:** Check Airtable — how many FeedbackForm submissions per month? If <5/month across both venues, feature 2.2 is data-starved.
3. **Polling failures:** How often does healthCheck() alert about stalled exports? If <1x per month, feature 2.1 is solving a non-problem.
4. **Ordering pain:** Do ordering staff complain about the ordering workflow?
5. **Venue #3:** Is there a third venue planned? If not, Phase 3 stays dead.

**Method:** 30-minute conversation with Evan + 15-minute chat with 1-2 ordering staff.

---

### 2.1 Self-Healing Polling (Simplified)

**Problem:** healthCheck() detects stalled requests but only sends alerts.

**Solution (10 lines of code, not a feature):**
- If stalled >15 min and retry count <2: reset state to REQUESTED
- If still stalled after retry: alert to Slack
- No escalation ladder. No new Airtable fields. No retry counter table.
- Add trigger existence guard before auto-recreating:

```javascript
// In healthCheck() — auto-retry stalled exports
if (stalledMinutes > 15 && record.fields['Export Retry Count'] < 2) {
  airtablePatch_(table, record.id, {
    'Export Request State': 'REQUESTED',
    'Export Retry Count': (record.fields['Export Retry Count'] || 0) + 1
  });
  Logger.log('Auto-retried stalled export: %s', record.id);
}

// Trigger recreation guard
const triggers = ScriptApp.getProjectTriggers();
const hasFn = triggers.some(t => t.getHandlerFunction() === 'processPrepRunExportRequests');
if (!hasFn) {
  ScriptApp.newTrigger('processPrepRunExportRequests').timeBased().everyMinutes(2).create();
  tryPostToSlack_(getSlackWebhook_('SLACK_WEBHOOK_EV_TEST'), 'Trigger recreated: processPrepRunExportRequests');
}
```

### Research Insights (Performance Oracle)

- **Add cooldown between retries** — Don't just reset to REQUESTED. The 2-minute poller will immediately pick it up. If the underlying issue is systemic, you'll burn 3 retries in 6 minutes. Add a "Retry After" timestamp and check it before processing.
- **Don't auto-recreate healthCheck's own trigger** — If the healthCheck trigger is missing, nothing can detect it. Accept this as a manual recovery step.

### Research Insights (Security Sentinel)

- **Max retry cap is essential** — Without it, a permanently failing export could burn GAS execution quota indefinitely. The `retry count < 2` check above handles this.
- **Log retries to Audit Log, not just Logger** — Logger output disappears after 7 days. Audit Log is permanent.

---

### 2.2 Predictive Par Level Suggestions (CONDITIONAL)

**Gate:** Only build if user validation confirms par level tuning is a real pain point.

**Problem:** Par levels are manually set. Staff may or may not find this burdensome.

**Solution (if validated):** Add a "Par Level Suggestions" view in Airtable, populated weekly:
- 4-week rolling average consumption from Prep Run data
- Suggestion = (rolling avg x 1.15 safety)
- Only flag items with >15% deviation from current par
- Manager reviews and manually updates (never auto-apply)

### Research Insights (Performance Oracle)

- **Hard prerequisite: Phase 1.1 (backoff) must be done first.** This feature makes 25-35 API calls in rapid succession. Without rate-limit handling, it will intermittently crash.
- **Pre-aggregate in Airtable** — Create a rollup/formula field on Prep Runs that computes average quantities per item. This reduces GAS to a simple read-and-compare (~5 API calls instead of 35).
- **Schedule on a different day** — Run Tuesday or Wednesday, when no other GAS triggers are active. Avoids rate-limit contention with Monday AM export.
- **Use denormalized fetches** — Fetch ALL Prep Tasks in one `airtableListAll_` call (no filtering by run), then filter in JavaScript. Two large paginated fetches are far cheaper than 10+ targeted-ID fetches.

### Research Insights (Simplicity)

- **YAGNI risk** — If manual par levels haven't been tuned for 6+ months, a predictive system will automate bad guesses. Make sure manual par tuning is mature before building automation on top of it.

---

### 2.3 Feedback Intelligence Loop (CONDITIONAL)

**Gate:** Only build if FeedbackForm usage is >5 submissions/month.

**Problem:** Feedback exists but isn't connected to prep docs.

**Solution (if validated):** Add a simple annotation during doc generation — if an item has >2 feedback reports in the last 4 weeks, add a note to the prep doc. No digest, no auto-suggest, no new tables.

### Research Insights (Product Manager)

- Five sub-features in the original plan. Cut to one: annotation on prep docs. The monthly digest, auto-suggest yield adjustments, and frequency tracking can come later if the basic annotation proves valuable.

---

## Deferred Items (Parking Lot)

These items were evaluated and deferred based on multi-agent consensus. They are not deleted — they are parked for future re-evaluation when conditions change.

### Cross-Venue Analytics Dashboard (was Phase 2.4)

**Status:** DEFERRED — No validated user demand. Requires separate GAS project + multi-trigger split. Would consume 50-80 of the 100-fetch-call limit per execution.

**When to revisit:** If Evan or managers express a need for cross-venue performance visibility. Use Airtable views for specific metrics in the meantime.

### Research Insights (Performance Oracle)

If eventually built:
- **Must run in a separate GAS project** — Cannot share execution limits with prep pipeline
- **Split into 3 triggered functions** — `updateSakuraMetrics()`, `updateWaratahMetrics()`, `computeComparisons()` — each stays within the 100-fetch limit
- **Use CacheService** with 6-hour TTL to avoid redundant API calls

---

### Event-Driven Architecture (was Phase 3.2)

**Status:** DEFERRED — Airtable webhooks expire after 7 days if not refreshed. Webhook payloads are cursors (not data), requiring additional API calls. Running both polling + webhooks creates race conditions.

**When to revisit:** If GAS execution quota becomes a real constraint, or if Airtable plan is upgraded to support webhooks.

### Research Insights (Architect)

If eventually built:
- **Step 1:** Add IN_PROGRESS state to prevent double-processing
- **Step 2:** Optimize polling (business hours only, reduces quota by ~60%)
- **Step 3:** Prototype webhooks in a sandbox GAS project
- **Step 4:** Run both with idempotency guards for 2-4 weeks before disabling polling

---

### Config-as-Data in Airtable (was Phase 3.1)

**Status:** DEFERRED — Adds network dependency to every GAS execution. Script Properties are fast, reliable, and sufficient.

**When to revisit:** If non-technical managers need to toggle feature flags without developer involvement.

### Research Insights (Architect, Performance Oracle)

If eventually built:
- **Must use CacheService** — Cache config with 1-hour TTL. Without it, adds 720 API calls/day from polling alone.
- **Keep secrets in Script Properties** — PATs, base IDs, webhook URLs must never be in Airtable.
- **Add `refreshConfig()` function** — Manual cache-bust for immediate flag changes.

---

### Multi-Venue Scaling Framework (was Phase 3.3)

**Status:** DEFERRED INDEFINITELY — No venue #3 planned. The current CFG pattern in PrepConfig.gs is already the right abstraction. What's needed for venue #3 is a checklist and templates, not a code framework.

### Research Insights (Architect)

- GAS does not support modules, interfaces, or dependency injection. The proposed "VenueConfig interface" cannot exist in GAS.
- What you actually need: a documented checklist (copy PrepConfig.gs, fill in values, create Airtable base, create GAS project, create agent from template).

---

### Supplier Integration (was Phase 3.4)

**Status:** DEFERRED — Entirely new product scope. No evidence ordering staff find manual ordering painful.

### Research Insights (Security Sentinel)

If eventually built:
- **Email injection risk** — If supplier email addresses come from Airtable and an attacker modifies them, orders go to wrong recipients. Validate email addresses against an allowlist.
- **Use GmailApp, not MailApp** — GmailApp supports sender verification and audit trail.

---

### Staff Performance Insights (was Phase 3.5)

**Status:** REMOVED — In a 2-4 person team, "anonymized" data is not anonymous. This is a management decision, not a technical feature.

---

## GAS Platform Constraints (Reference)

Discovered during deepening — these constraints affect all future development:

| Constraint | Limit | Impact |
|-----------|-------|--------|
| Execution time | 6 minutes per function | Affects analytics, predictive par |
| URL fetch calls | 100 per execution | **Binding constraint** for API-heavy operations |
| Triggers | 20 per project | Must audit before adding any; consolidate if <5 remaining |
| CacheService | 100KB per key, 6-hour max TTL | Sufficient for config caching |
| Daily execution quota | 90 min (consumer) / 6 hr (Workspace) | Polling consumes steady baseline |
| Web app redeployment | Changes published URL | Invalidates any registered webhooks |

---

## Risk Assessment (Updated)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rate limit retry breaks existing flow | Low | High | Test with mock 429 responses; one-function change; jitter prevents thundering herd |
| Trigger budget exceeded | Medium | High | **Audit first** (item 1.4); consolidate if <5 remaining |
| Predictive par suggests wrong values | Medium | Medium | Suggestion-only; requires manager approval; gate on user validation |
| Self-healing causes retry storm | Low | Medium | Max 2 retries; cooldown between retries; audit log tracking |
| Deleting fallback generators removes needed code | Low | Low | Templates have been standard since v4.2; no fallback needed in 3+ months |
| 100-fetch limit hit during large exports | Low | High | Use denormalized fetches (airtableListAll_ not airtableGetByIds_); monitor with Logger |

---

## What the Plan Should Actually Be

Per the Simplicity Reviewer's recommendation — the honest, minimal version:

### Do Now (1-2 days)
1. **Extract recipe resolution + add API retry** (1.1) — One PR, one deploy per venue
2. **Delete dead fallback generators** (1.2) — 30 minutes

### Do This Week (1 day)
3. **Verify PrepDocGenerators split status** (1.3) — 5 minutes
4. **Audit GAS trigger budget** (1.4) — 15 minutes per venue
5. **Add error classification** (1.5) — 30 minutes

### Do After User Validation (1-2 weeks)
6. **Self-healing polling** (2.1) — 10 lines of code
7. **Predictive par suggestions** (2.2) — Only if staff ask for it
8. **Feedback annotations** (2.3) — Only if feedback form is actually used

### Next High-Value Feature (After Phase 2)
9. **Supplier email integration** — Auto-email purchase orders to suppliers from ordering docs. Saves ~100 manual emails/year. Narrow scope: email-only, no supplier portal. Use `MailApp.sendEmail()` with ordering doc as PDF attachment. Add "Supplier Contacts" table to Airtable.

### Do in Parallel (Bus Factor Mitigation)
10. **Write operational runbook** — 5 most common failure modes + resolution steps, written for a non-developer (venue manager who can follow instructions)
11. **Designate a backup operator** — Second person who can run `clasp push` and read Airtable automation logs
12. **Document all GAS triggers** — Expected schedule per trigger, so someone can verify "is the system running?" without understanding code

### Don't Do (Until Conditions Change)
13. Everything else — deferred with clear "when to revisit" criteria

**The system is rated A-. It works. It is in production. The biggest risk is unnecessary complexity from well-intentioned improvements. The second biggest risk is the bus factor.**

---

## Technologies & Frameworks

- **Google Apps Script** (V8 runtime, Australia/Sydney timezone, 6-min/100-fetch limits)
- **Airtable REST API** (rate limit: 5 req/sec per base, per-base not global)
- **Airtable Automations** (scripting actions; no shared module system for utility functions)
- **Google Docs API** (DocumentApp, DriveApp, UrlFetchApp)
- **Slack Incoming Webhooks** (Block Kit messages; consider migrating to Slack App + Bot tokens for better rate limiting and message management — Slack Expert recommendation)
- **clasp** (GAS deployment CLI)
- **MCP Protocol** (Airtable + Google Workspace tooling for Claude Code agents)
- **CacheService** (GAS built-in cache; use for any future config-from-Airtable patterns)
