# Analytics Dashboard — Quick Start Guide

**Status:** Ready to implement
**Created:** 2026-03-23
**Time to implement:** 5 weeks (in phases)

---

## What You're Building

A Google Sheet dashboard that automatically fetches data from Airtable and displays 7 key metrics for kitchen prep operations:

1. **Prep Efficiency** — % of ordered items that match what was prepped (variance analysis)
2. **Waste Indicators** — Items consistently above/below par levels
3. **Recipe Popularity** — Top 10 recipes by prep frequency (4-week rolling)
4. **Staff Workload** — Ordering distribution (Gooch vs Sabs for Sakura; Evan for Waratah)
5. **Feedback Trends** — Staff feedback volume, resolution rates, problem items
6. **Automation Health** — Script success rates, execution times, error tracking
7. **Cross-Venue Comparison** — Sakura vs Waratah side-by-side

---

## Files Provided

| File | Purpose |
|------|---------|
| `ANALYTICS_DASHBOARD_DESIGN.md` | **Full specification** — read this first for understanding |
| `ANALYTICS_DASHBOARD_CODE_TEMPLATE.gs` | **Ready-to-use code scaffold** — copy into GAS project |
| `ANALYTICS_DASHBOARD_QUICKSTART.md` | **This file** — implementation checklist |

---

## Setup Steps (30 minutes)

### Step 1: Create Google Sheet

1. Create a new Google Sheet (e.g., "PREP Analytics Dashboard")
2. Get its ID from the URL: `https://docs.google.com/spreadsheets/d/{ID}/...`
3. Copy the ID

### Step 2: Set Up GAS Project

1. Open Apps Script project linked to the Google Sheet
2. Go **Project Settings** → **Script Properties**
3. Add two properties:
   ```
   DASHBOARD_SHEET_ID = [paste the ID from Step 1]
   AIRTABLE_PAT = [your Airtable Personal Access Token]
   ```

### Step 3: Copy Code Template

1. In Apps Script, create a new file: **File → New → Script**
2. Name it `AnalyticsDashboard.gs`
3. Copy the entire contents from `ANALYTICS_DASHBOARD_CODE_TEMPLATE.gs`
4. Paste into the Apps Script editor

### Step 4: Configure Airtable Table IDs

In the `CFG` object (lines 30–75 of the template), fill in the actual table IDs for each venue:

```javascript
const CFG = {
  venues: {
    sakura: {
      baseId: 'appNsFRhuU47e9qlR',  // Already correct
      tables: {
        items: 'tblMiIJW5c1yaKATc',           // Find actual ID
        supplier: 'tblSOucoAqhDTI2j4',        // Find actual ID
        recipes: 'tblIuwtYka7LIaegW',         // ... etc
        // Fill in all table IDs from Airtable schema docs
      }
    },
    waratah: {
      baseId: 'appfcy14ZikhKZnRS',  // Already correct
      tables: {
        items: 'tblXXXXXXXXXXXXXXXX',         // Find actual IDs
        // ... etc
      }
    }
  }
};
```

**Where to find table IDs:**
- Open Airtable base in browser
- Click table name dropdown at top left
- Right-click table name → copy URL
- ID is the part after `/tbl` in the URL

Alternatively, read from the schema docs:
- `Sakura House/docs/AIRTABLE_SCHEMA.md` — has all Sakura table IDs
- `The Waratah/docs/AIRTABLE_SCHEMA.md` — has all Waratah table IDs

### Step 5: Test Manual Refresh

1. In Google Sheet, click **Analytics → Refresh All Data**
2. Check the Logs:
   - Apps Script **Executions** panel should show "Completed" status
   - Look for any errors in the **Logs** output
3. If successful, data will populate the sheet tabs

---

## Implementation Phases (5 weeks)

### Phase 2.4a: Foundation (Week 1)

**Goal:** Verify architecture and data fetching

**Tasks:**
- [ ] Complete setup steps above
- [ ] Create all 9 Google Sheet tabs (headers only for now)
- [ ] Test `dailyRefresh()` → verify it fetches Airtable data without errors
- [ ] Check Apps Script Logs for rate-limit warnings

**Success criteria:**
- No API errors
- Data Cache tab shows fetch timestamps

---

### Phase 2.4b: Core Metrics (Week 2)

**Goal:** Implement metrics 2.1–2.3 and populate sheets

**Tasks:**
- [ ] Uncomment `calculatePrepEfficiency_()` and `writePrepEfficiencyTab_()`
- [ ] Test `dailyRefresh()` → verify **Prep Efficiency** tab populates
- [ ] Uncomment `calculateWasteIndicators_()` and `writeWasteAnalysisTab_()`
- [ ] Test → verify **Waste Analysis** tab populates
- [ ] Uncomment `calculateRecipePopularity_()` and `writeRecipePopularityTab_()`
- [ ] Test → verify **Recipe Popularity** tab populates
- [ ] Embed charts in each tab (line, bar, heatmap)
- [ ] Add conditional formatting (color-coding)

**Success criteria:**
- All 3 tabs populate with data
- Charts render correctly
- No execution errors

---

### Phase 2.4c: Secondary Metrics (Week 3)

**Goal:** Implement metrics 2.4–2.6

**Tasks:**
- [ ] Uncomment `calculateStaffWorkload_()` and `writeStaffWorkloadTab_()`
- [ ] Test → verify **Staff Workload** tab populates
- [ ] Uncomment `calculateFeedbackTrends_()` and `writeFeedbackTrendsTab_()`
- [ ] Test → verify **Feedback Trends** tab populates
- [ ] Uncomment `calculateAutomationHealth_()` and `writeAutomationHealthTab_()`
- [ ] Test → verify **Automation Health** tab populates
- [ ] Embed charts and conditional formatting

**Success criteria:**
- All 6 metric tabs complete
- Staff workload balancing clearly visible
- Feedback and health status color-coded

---

### Phase 2.4d: Cross-Venue & Scheduling (Week 4)

**Goal:** Build cross-venue comparison and set up automated triggers

**Tasks:**
- [ ] Create `calculateCrossVenueComparison_()` function
- [ ] Create `writeCrossVenueComparisonTab_()`
- [ ] Populate **Cross-Venue Comparison** tab
- [ ] Embed radar charts + trend comparisons
- [ ] In Apps Script, create time-driven triggers:
  - Daily at 10:00 PM → `dailyRefresh()`
  - Saturday at 4:00 PM → `weeklyRefresh()`
  - Every 10 minutes → `realtimePolling()` (optional)
- [ ] Test triggers (monitor **Executions** tab in Apps Script)

**Success criteria:**
- Cross-venue comparison shows clear differences
- Triggers fire at expected times
- No missed executions

---

### Phase 2.4e: Polish & Deploy (Week 5)

**Goal:** Final testing, user documentation, rollout

**Tasks:**
- [ ] Add error handling + Slack alerts for failures
- [ ] Optimize execution time (target < 90 seconds total)
- [ ] Create user guide (see section below)
- [ ] Train managers on interpreting metrics
- [ ] Run 1-week pilot with live data
- [ ] Monitor for edge cases and fix bugs
- [ ] Roll out to all managers
- [ ] Lock sheet (View only for staff, Edit for admins)

**Success criteria:**
- Zero API errors in production
- All metrics refresh automatically
- Managers can interpret dashboard without help

---

## Testing Checklist

**Before deploying to production:**

### Unit Tests (per metric)

- [ ] **Prep Efficiency:** Verify calculation with known data
  - Manual: Create 1 prep run with 3 items ordered, 2 prepared exactly, 1 over
  - Expected: ~89% efficiency (2/3 * 100)

- [ ] **Waste Indicators:** Verify par-level detection
  - Manual: Create weekly count with qty = par × 1.5
  - Expected: Flagged as OVER-STOCK after 3+ weeks

- [ ] **Recipe Popularity:** Verify top-10 ranking
  - Manual: Create 15 prep tasks for 3 items
  - Expected: Top 10 filters out lower-frequency items

- [ ] **Staff Workload:** Verify load distribution
  - Manual (Sakura): Create ingredient reqs with Gooch = 1000ml, Sabs = 900ml
  - Expected: Gooch 52.6%, Sabs 47.4% (or similar)

- [ ] **Feedback Trends:** Verify open/resolved counting
  - Manual: Create 10 feedback records (8 resolved, 2 open)
  - Expected: 80% resolution rate

- [ ] **Automation Health:** Verify script success rate
  - Manual: Check Audit Log with 9 successes, 1 error
  - Expected: 90% success rate

- [ ] **Rate Limiting:** Verify API throttling
  - Run `dailyRefresh()` 3 times in quick succession
  - Expected: No "Rate Limit Hit" errors, uses cache on 2nd/3rd run

### Integration Tests

- [ ] Full daily refresh completes in < 90 seconds
- [ ] Both venues' data fetches simultaneously without conflicts
- [ ] Cross-venue comparison matches individual venue metrics
- [ ] Sheet tabs remain readable with 4+ weeks of data
- [ ] Cache correctly expires after 2 hours

### User Acceptance Tests

- [ ] Non-technical manager can navigate sheet
- [ ] Color-coded alerts are obvious (green/yellow/red)
- [ ] Timestamps show when data was last updated
- [ ] Manual refresh works from menu
- [ ] Charts display correctly on mobile device

---

## Troubleshooting

### "Library with identifier X is missing"

**Cause:** Old version of code referencing deleted libraries
**Fix:** In Apps Script, go to **Libraries** and remove any unused dependencies; then `clasp push --force`

### "Rate Limit Exceeded"

**Cause:** Too many Airtable API calls in short time
**Fix:**
- Check if cache is working (look for "Cache hit" in Logs)
- If cache always misses, increase `CFG.cache.ttlSeconds` to 14400 (4 hours)
- Reduce polling frequency (if polling enabled)

### Sheet tab not updating

**Cause:** Trigger not firing or function has an error
**Fix:**
- In Apps Script, check **Executions** tab for errors
- Read the Logs output for details
- Manually run `manualRefresh()` to test
- Verify table IDs match actual Airtable tables

### "Cannot read property 'Date' of undefined"

**Cause:** Field name mismatch (e.g., 'Date' doesn't exist in table, or is named differently)
**Fix:**
- Check field names in Airtable schema docs
- Update code to match exact field names (case-sensitive!)
- Verify Waratah uses 'Date', not 'Created' or other variant

### Execution timeout (> 6 minutes)

**Cause:** Too much data or slow API calls
**Fix:**
- Reduce data window (4 weeks → 2 weeks)
- Break into smaller GAS scripts
- Cache intermediate results in sheet
- Check Airtable API status (may be slow)

---

## Manager User Guide

### Where is the Dashboard?

Open the shared Google Sheet (ask your admin for the link). It's titled **"PREP Systems Analytics Dashboard"**.

### How do I read it?

1. **DASHBOARD tab** — High-level overview. Green = good, Yellow = warning, Red = needs attention.
2. **Detailed tabs** — Click any metric name to see the full breakdown.
3. **Charts** — Visualizations are embedded in each tab for quick trends.

### What do the colors mean?

- **Green** — Metric is on track (e.g., efficiency 95–105%, no failures)
- **Yellow** — Metric is slightly off (e.g., efficiency 90–95%, 1 script error)
- **Red** — Metric needs immediate attention (e.g., efficiency < 90%, multiple failures)

### How do I know if data is fresh?

Each tab shows **"Last Updated: [timestamp]"** at the bottom. If it's older than 24 hours, ask your admin to refresh.

### What should I do if I see a red alert?

1. Click the metric name to see details
2. Identify the problem item/staff/script
3. Note the date and impact
4. Discuss with your team lead or contact your admin

### Can I export or print this?

Yes. The sheet is editable for admins only, but you can download it as Excel or PDF for meetings.

---

## Admin Reference

### Setting Up Time-Driven Triggers

In Apps Script editor:

1. Click **⏰ Triggers** (left sidebar)
2. Click **Create new trigger**
3. For daily refresh:
   - Function: `dailyRefresh`
   - Deployment: Head
   - Event source: Time-driven
   - Type: Day timer
   - Time of day: 10:00 PM
   - Time zone: Australia/Sydney
4. Click **Save**
5. Repeat for `weeklyRefresh` (Saturday 4:00 PM)

### Monitoring Trigger Health

Every trigger execution is logged in Apps Script **Executions** tab:

- **Green checkmark** = Success
- **Red X** = Failed (click to see error)
- **Clock icon** = Running now

Target: 99%+ success rate (allow 1 failure per month)

### Updating Table IDs

If you add a new table to Airtable:

1. Get the table ID (right-click table name → copy URL)
2. Edit `AnalyticsDashboard.gs` → update `CFG.venues[venue].tables`
3. Deploy with `clasp push`
4. Run `manualRefresh()` to test

### Handling Missing Data

If a table has fewer than 5 records:

- The metric calculation may return null or empty
- The sheet will show the tab but no data rows
- This is normal during initial setup; data grows over 4 weeks

### Rate Limiting Troubleshooting

If you see many API calls logged:

1. Check if refresh is running multiple times (trigger misconfigured?)
2. Verify cache is enabled in code
3. If still high, reduce polling frequency or split script into smaller pieces

---

## Next Steps

1. **Read the full design:** `ANALYTICS_DASHBOARD_DESIGN.md` (40 min read)
2. **Set up:** Follow "Setup Steps" above (30 min)
3. **Implement Phase 2.4a:** Test data fetching (2 hours)
4. **Implement Phases 2.4b–e:** Follow the weekly phased approach (5 weeks)
5. **Deploy:** Roll out to managers with training

---

## Support

If you get stuck:

1. **Check Logs** — Apps Script **Logs** panel often shows exact error
2. **Review schema docs** — Verify field names and table IDs match Airtable
3. **Test manually** — Run `manualRefresh()` and watch the execution step-by-step
4. **Ask in Slack** — Post error in #dev-support channel with timestamp + error message

---

**Status:** Ready to implement. Start with Phase 2.4a this week.
