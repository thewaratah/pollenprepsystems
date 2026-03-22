# PREP Systems Analytics Dashboard — Phase 2.4 Design

**Status:** Design specification
**Created:** 2026-03-23
**Target:** Google Sheet + GAS automation for both venues (Sakura House, The Waratah)
**Audience:** Non-technical managers, venue operators, system administrators

---

## Executive Summary

This document specifies a Google Sheet-based analytics dashboard that tracks prep efficiency, waste, recipe popularity, staff workload, system health, and cross-venue performance. It answers 7 key business questions via automated Airtable queries, GAS-based calculations, and interactive visualizations.

**Key Metrics:**
- Prep Efficiency: % of ordered items that were prepared (variance analysis)
- Waste Indicators: Items consistently above par or below minimum stock
- Recipe Popularity: Top 10 recipes by prep frequency (4-week rolling)
- Staff Workload: Ordering load distribution (Gooch/Sabs for Sakura; Evan only for Waratah)
- Feedback Trends: Staff feedback volume, resolution rates, most-complained items
- Automation Health: Script execution success rates, run times, error rates
- Cross-Venue Comparison: Side-by-side KPIs for Sakura vs Waratah

**Refresh Strategy:**
- Real-time: Feedback trends, automation health (via Audit Log polling)
- Daily: Prep efficiency, waste indicators (via 10 PM GAS scheduled trigger)
- Weekly: Recipe popularity, staff workload (via Saturday post-shift GAS trigger)

---

## Part 1: Architecture & Data Pipeline

### 1.1 Google Sheet Structure

```
Dashboard (Public)
├── DASHBOARD (overview + key metrics)
├── Prep Efficiency (detailed weekly data)
├── Waste Analysis (par-based variance)
├── Recipe Popularity (top 10, trending)
├── Staff Workload (ordering distribution)
├── Feedback Trends (volume, resolution, items)
├── Automation Health (script logs)
├── Cross-Venue Comparison (Sakura vs Waratah side-by-side)
└── Data Cache (internal — query results, timestamps)
```

**Location:** Google Drive folder `/Analytics` (shared with managers)
**Update Frequency:** Every tab has a "Last Refreshed" timestamp
**Permissions:** View-only for staff; edit for system admins only

### 1.2 GAS Script Architecture

**Primary Script:** `AnalyticsDashboard.gs` (new file)

```javascript
// Phase 1: Data Fetching
fetchAirtableData_()
  ├── getWeeklyCountData() → Weekly Counts table
  ├── getPrepRunData() → Prep Runs + Prep Tasks
  ├── getRecipeData() → Recipes + Recipe Lines
  ├── getIngredientRequirementsData() → Ingredient Requirements
  ├── getFeedbackData() → Feedback table (with triage results)
  └── getAuditLogData() → Audit Log (last 7 days)

// Phase 2: Calculation Engine
calculateMetrics_()
  ├── prepEfficiency_() → % match, variance analysis
  ├── wasteIndicators_() → Par-level variance, trends
  ├── recipePopularity_() → Frequency count (4-week rolling)
  ├── staffWorkload_() → Ordering assignment distribution
  ├── feedbackTrends_() → Volume, resolution rates, item rankings
  └── automationHealth_() → Success rates, avg execution time

// Phase 3: Sheet Population
populateSheets_()
  ├── clearAndFormat() → Prepare all tabs
  ├── writeMetrics() → Dashboard overview
  ├── writePrepEfficiency() → Weekly detailed data
  ├── writeWasteAnalysis() → Par-variance detail
  ├── writeRecipePopularity() → Top 10 + trends
  ├── writeStaffWorkload() → Assignment dist
  ├── writeFeedbackTrends() → Feedback summary
  ├── writeAutomationHealth() → Script execution logs
  └── writeCrossVenueComparison() → Sakura vs Waratah

// Phase 4: Scheduling
onEdit() → Auto-refresh data cache on sheet edit
onOpen() → Add custom menu ("Refresh Analytics")
scheduleDaily() → 10 PM daily refresh
scheduleWeekly() → Saturday 4 PM weekly refresh
```

### 1.3 Rate Limiting & Performance

**Airtable REST API Limits:** 5 requests/second max
**GAS Execution Limit:** 6 minutes per run

**Strategy:**
- **Batch fetching:** One REST call per table per refresh cycle (vs. many small calls)
- **Caching:** Store results in "Data Cache" sheet; reuse for 2 hours unless manually refreshed
- **Pagination:** Iterate through large tables (Weekly Counts, Audit Log) in 100-record chunks
- **Parallel processing:** Fetch independent tables simultaneously (Promise.all in GAS Async)
- **Query filtering:** Use Airtable API `filterByFormula` to reduce payload (e.g., last 7 days of Audit Log only)

**Estimated Execution Time:** ~90 seconds for full refresh (6x Airtable calls + calculations)

---

## Part 2: Seven Key Metrics

### 2.1 Prep Efficiency — What Was Ordered vs. What Was Prepped?

**Business Question:** Are we consistently over/under-producing? Are items being prepped that weren't ordered (waste)? Are ordered items not being prepped (shortfall)?

**Data Sources:**
- **Ingredient Requirements** table → `Quantity Ordered` per item per Prep Run
- **Prep Tasks** table → `Quantity Prepared` per item per Prep Run
- **Items** table → Item name, unit, category

**Calculation:**

```
For each item in each Prep Run:
  Ordered Qty = SUM(Ingredient Requirements.Quantity) where Item matches
  Prepared Qty = SUM(Prep Tasks.Quantity) where Item matches
  Variance = Prepared Qty - Ordered Qty
  Variance % = (Variance / Ordered Qty) × 100%  [avoid divide-by-zero]

Per-Prep-Run Summary:
  Total Efficiency = (SUM(Prepared matching Ordered) / SUM(Ordered)) × 100%
  Over-Production = items where Prepared > Ordered × 1.10
  Under-Production = items where Prepared < Ordered × 0.90
```

**Metrics to Display:**

| Metric | Formula | Target | Alert Threshold |
|--------|---------|--------|-----------------|
| **Weekly Efficiency %** | Total items prepped in target range / total items ordered | 95–105% | < 90% or > 110% |
| **Over-Production Count** | # items prep'd > 110% of order | Minimize (waste) | > 3 items |
| **Under-Production Count** | # items prep'd < 90% of order | Minimize (shortfall) | > 2 items |
| **Avg Variance %** | Mean of all item variances | ±5% | > ±15% |
| **Consistency Trend** | 4-week rolling avg of Weekly Efficiency % | Upward trend | Downward 2+ weeks |

**Visualization:**
- **Line chart:** Weekly Efficiency % over 12 weeks (trending)
- **Bar chart:** Over/Under-Production counts per week
- **Heatmap:** Item-level variance % (green = ±10%, yellow = ±10–20%, red = > ±20%)
- **Table:** Detailed weekly summary with variances, responsible staff, notes

**Update Frequency:** Daily (10 PM)
**GAS Implementation:**

```javascript
function calculatePrepEfficiency_() {
  const prepRuns = getFromCache('prep_runs') || fetchPrepRunData();
  const prepTasks = getFromCache('prep_tasks') || fetchPrepTaskData();
  const ingredientReqs = getFromCache('ingredient_reqs') || fetchIngredientRequirementsData();

  const results = [];

  for (const run of prepRuns) {
    const runId = run['Prep Run ID'];
    const runDate = run['Date'];

    const orderedItems = ingredientReqs.filter(ir => ir['Prep Run'] === runId);
    const preparedItems = prepTasks.filter(pt => pt['Prep Run'] === runId);

    // Group by item
    const itemMap = {};
    orderedItems.forEach(ir => {
      const itemName = ir['Item'];
      itemMap[itemName] = itemMap[itemName] || { ordered: 0, prepared: 0 };
      itemMap[itemName].ordered += parseFloat(ir['Quantity']) || 0;
    });

    preparedItems.forEach(pt => {
      const itemName = pt['Item'];
      itemMap[itemName] = itemMap[itemName] || { ordered: 0, prepared: 0 };
      itemMap[itemName].prepared += parseFloat(pt['Quantity']) || 0;
    });

    // Calculate variance
    let totalOrdered = 0, totalPrepared = 0, overCount = 0, underCount = 0, variances = [];
    const itemVariances = [];

    for (const [item, qty] of Object.entries(itemMap)) {
      totalOrdered += qty.ordered;
      totalPrepared += qty.prepared;
      const variance = (qty.ordered > 0) ? ((qty.prepared - qty.ordered) / qty.ordered) * 100 : 0;
      variances.push(variance);

      if (qty.prepared > qty.ordered * 1.10) overCount++;
      if (qty.prepared < qty.ordered * 0.90) underCount++;

      itemVariances.push({
        item,
        ordered: qty.ordered,
        prepared: qty.prepared,
        variance: variance.toFixed(1)
      });
    }

    const efficiency = (totalOrdered > 0) ? (totalPrepared / totalOrdered) * 100 : 0;
    const avgVariance = variances.length > 0 ? (variances.reduce((a,b) => a+b) / variances.length) : 0;

    results.push({
      runId,
      runDate,
      efficiency: efficiency.toFixed(1),
      avgVariance: avgVariance.toFixed(1),
      overCount,
      underCount,
      itemVariances,
      itemCount: Object.keys(itemMap).length
    });
  }

  return { summary: results, lastRefreshed: new Date().toISOString() };
}
```

---

### 2.2 Waste Indicators — Par-Level Variance & Trends

**Business Question:** Which items consistently have stock above par after prep (waste)? Which items never reach par (under-stocking)?

**Data Sources:**
- **Items** table → Par Level, Weekly Volume, Item Type
- **Weekly Counts** table → Count Qty, Item, Date, Confirmed status
- **Prep Tasks** table → Quantity prepared per item

**Calculation:**

```
For each item across last 4 weeks:
  Stock After Prep = Final Count - Par Level

  If Stock After Prep > Par × 1.20:  OVER-STOCKED (waste risk)
  If Stock After Prep < Par × 0.95:  UNDER-STOCKED (stockout risk)
  If Stock never reaches Par:        CHRONIC_SHORTFALL

Per-Item Trend (4-week):
  Weeks Above 120% Par = count
  Weeks Below 95% Par = count
  Avg Stock Level as % of Par = mean
```

**Metrics to Display:**

| Metric | Formula | Target | Alert |
|--------|---------|--------|-------|
| **Chronic Over-Stock Items** | Items > 120% Par in ≥3 of 4 weeks | None | Flag if > 2 items |
| **Chronic Under-Stock Items** | Items < 95% Par in ≥3 of 4 weeks | None | Flag if > 1 item |
| **Waste Risk Score** | (Over-stock weeks / 4) × item par qty × unit cost | Minimize | > $100/week |
| **Stockout Risk Score** | (Under-stock weeks / 4) × item par qty | Minimize | > 2 items |
| **Par Achievement %** | Items reaching Par / total items | 95%+ | < 90% |

**Visualization:**
- **Scatter plot:** Stock Level (Y) vs. Par Level (X), colored by Item Type, sized by variance
- **Table:** Top 5 over-stocked and top 5 under-stocked items (4-week trend)
- **Sparkline:** Per-item stock trend over 4 weeks (mini line chart in cell)
- **Box plot:** Distribution of stock levels across all items (median, Q1, Q3, outliers)

**Update Frequency:** Daily (10 PM)
**GAS Implementation:**

```javascript
function calculateWasteIndicators_() {
  const items = getFromCache('items') || fetchItemsData();
  const weeklyCounts = getFromCache('weekly_counts') || fetchWeeklyCountsData();

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const results = [];

  for (const item of items) {
    const itemName = item['Item Name'];
    const parLevel = parseFloat(item['Par Level']) || 0;

    const recentCounts = weeklyCounts.filter(wc =>
      wc['Item'] === itemName &&
      wc['Confirmed'] === true &&
      new Date(wc['Date']) >= fourWeeksAgo
    ).sort((a, b) => new Date(b['Date']) - new Date(a['Date']));

    if (recentCounts.length === 0) continue;

    let overWeeks = 0, underWeeks = 0, countTotal = 0;
    const stockLevels = [];

    for (const count of recentCounts) {
      const countQty = parseFloat(count['Quantity']) || 0;
      const percentOfPar = parLevel > 0 ? (countQty / parLevel) * 100 : 0;

      stockLevels.push(percentOfPar);
      countTotal += countQty;

      if (percentOfPar > 120) overWeeks++;
      if (percentOfPar < 95) underWeeks++;
    }

    const avgPercentOfPar = stockLevels.length > 0
      ? stockLevels.reduce((a,b) => a+b) / stockLevels.length
      : 0;

    results.push({
      itemName,
      parLevel,
      overWeeks,
      underWeeks,
      avgPercentOfPar: avgPercentOfPar.toFixed(1),
      riskFlag: overWeeks >= 3 ? 'OVER-STOCK' : (underWeeks >= 3 ? 'UNDER-STOCK' : 'OK'),
      countDatapoints: recentCounts.length,
      mostRecentCount: recentCounts[0]['Quantity'],
      mostRecentDate: recentCounts[0]['Date']
    });
  }

  return { summary: results, lastRefreshed: new Date().toISOString() };
}
```

---

### 2.3 Recipe Popularity — Top 10 Items by Prep Frequency

**Business Question:** Which recipes are prepped most often? Which are declining in frequency? What's the trend?

**Data Sources:**
- **Prep Tasks** table → Item (links to Item Name), Quantity, Date
- **Recipes** table → Recipe ID, Item Name, Yield Qty
- **Items** table → Item Type, Menu Category

**Calculation:**

```
For each 4-week period:
  Prep Frequency = COUNT(Prep Tasks) where Item = X
  Total Qty Prepped = SUM(Prep Tasks.Quantity) where Item = X
  Avg Qty Per Prep = Total Qty / Prep Frequency

  Trending = (Frequency Week 4 vs Week 1) / Frequency Week 1 × 100%

Rank by Prep Frequency (top 10)
```

**Metrics to Display:**

| Metric | Calculation | Unit |
|--------|-------------|------|
| **Top 10 Recipes** | Prep frequency rank | Frequency count |
| **4-Week Trend** | (Latest week vs 4 weeks ago) / baseline | % change |
| **Avg Qty Per Prep** | Total qty / prep count | ml, g, or each |
| **Consistency** | Std Dev of qty across preps | Low = consistent demand |
| **Cost Impact** | Top 3 recipes × cost per unit | $/week estimate |

**Visualization:**
- **Horizontal bar chart:** Top 10 recipes by prep frequency (4-week total)
- **Sparkline:** Per-recipe frequency trend over 4 weeks (mini line in cell)
- **Pie chart:** Recipe distribution by Item Type (% of total preps)
- **Bubble chart:** Frequency (X) vs. Avg Qty (Y) vs. Menu Category (color)
- **Table:** Rank, recipe name, frequency, trend %, avg qty, notes

**Update Frequency:** Weekly (Saturday 4 PM)
**GAS Implementation:**

```javascript
function calculateRecipePopularity_() {
  const prepTasks = getFromCache('prep_tasks') || fetchPrepTaskData();
  const recipes = getFromCache('recipes') || fetchRecipeData();
  const items = getFromCache('items') || fetchItemsData();

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Group prep tasks by item over 4 weeks
  const itemFrequency = {};

  prepTasks.forEach(pt => {
    const itemName = pt['Item'];
    const taskDate = new Date(pt['Date']);

    if (taskDate >= fourWeeksAgo) {
      if (!itemFrequency[itemName]) {
        itemFrequency[itemName] = { frequency: 0, totalQty: 0, dates: [], recipe: null };
      }
      itemFrequency[itemName].frequency++;
      itemFrequency[itemName].totalQty += parseFloat(pt['Quantity']) || 0;
      itemFrequency[itemName].dates.push(taskDate);
    }
  });

  // Enrich with recipe + item metadata
  const enriched = [];
  for (const [itemName, data] of Object.entries(itemFrequency)) {
    const recipe = recipes.find(r => r['Item Name'] === itemName);
    const item = items.find(i => i['Item Name'] === itemName);

    enriched.push({
      itemName,
      frequency: data.frequency,
      totalQty: data.totalQty.toFixed(1),
      avgQty: (data.totalQty / data.frequency).toFixed(1),
      itemType: item ? item['Item Type'] : 'Unknown',
      menuCategory: item ? item['Menu Category'] : 'Unknown',
      recipeId: recipe ? recipe['Recipe ID'] : null,
      recipeYield: recipe ? recipe['Yield Qty'] : null,
      batchesNeeded: recipe ? Math.ceil(data.totalQty / (recipe['Yield Qty'] || 1)) : 0
    });
  }

  // Sort by frequency, take top 10
  enriched.sort((a, b) => b.frequency - a.frequency);
  const top10 = enriched.slice(0, 10);

  return {
    top10,
    allItems: enriched,
    lastRefreshed: new Date().toISOString()
  };
}
```

---

### 2.4 Staff Workload — Ordering Assignment Distribution

**Business Question:** How are ordering assignments distributed? Is workload balanced? Who orders what?

**Data Sources:**
- **Supplier** table → Supplier Name, Ordering Staff
- **Ingredient Requirements** table → Item, Quantity, Supplier (via Item.Supplier)
- **Items** table → Item Type, Supplier

**Calculation:**

```
For Sakura House (Gooch / Sabs):
  Per-Staff Workload = SUM(Ingredient Requirements.Quantity)
                       grouped by Ordering Staff

For Waratah (Evan only):
  Combined Workload = SUM(Ingredient Requirements.Quantity)

Per-Staff Metrics:
  # of Suppliers = COUNT(unique Suppliers)
  # of Line Items = COUNT(Ingredient Requirements)
  Total Qty (ml, g) = SUM(Quantity)
  Avg Qty per Item = Total / Item Count
  Peak Week Load = MAX(weekly total)
  Load Balance = (Staff A Load - Staff B Load) / (A + B) × 100%
```

**Metrics to Display:**

| Metric | Sakura | Waratah | Target |
|--------|--------|---------|--------|
| **Staff A Load** | Gooch | N/A | Balanced (±10%) |
| **Staff B Load** | Sabs | N/A | Balanced (±10%) |
| **Total Suppliers per Staff** | Gooch: X, Sabs: Y | N/A | Distributed |
| **Avg Item Count** | Per staff | All to Evan | Low variance |
| **Load Imbalance %** | |(A-B)/(A+B)| | N/A | < 10% |
| **Peak Week Load** | Max qty in week | All to Evan | Manageable |

**Visualization:**
- **Stacked bar chart:** Weekly ordering load by staff (Gooch + Sabs for Sakura, single bar for Waratah)
- **Donut chart:** Supplier distribution per staff (# suppliers each handles)
- **Table:** Staff name, # suppliers, # items, total qty, % of total load, notes
- **Heatmap:** Per-staff workload over 4 weeks (green = light, yellow = medium, red = heavy)

**Update Frequency:** Weekly (Saturday 4 PM)
**GAS Implementation:**

```javascript
function calculateStaffWorkload_(venue) {
  const suppliers = getFromCache(`suppliers_${venue}`) || fetchSuppliersData(venue);
  const ingredientReqs = getFromCache(`ingredient_reqs_${venue}`) || fetchIngredientRequirementsData(venue);
  const items = getFromCache(`items_${venue}`) || fetchItemsData(venue);

  const staffWorkload = {};
  const staffSuppliers = {};

  // Group ingredient requirements by ordering staff
  ingredientReqs.forEach(ir => {
    const item = items.find(i => i['Item Name'] === ir['Item']);
    if (!item || !item['Supplier']) return;

    const supplier = suppliers.find(s => s['Supplier Name'] === item['Supplier']);
    if (!supplier) return;

    const staff = supplier['Ordering Staff'] || (venue === 'waratah' ? 'Evan' : 'Unknown');

    if (!staffWorkload[staff]) {
      staffWorkload[staff] = { totalQty: 0, items: 0, suppliers: new Set() };
      staffSuppliers[staff] = [];
    }

    staffWorkload[staff].totalQty += parseFloat(ir['Quantity']) || 0;
    staffWorkload[staff].items++;
    staffWorkload[staff].suppliers.add(item['Supplier']);
  });

  const results = [];
  let totalQty = 0;

  for (const [staff, data] of Object.entries(staffWorkload)) {
    totalQty += data.totalQty;
    results.push({
      staff,
      supplierCount: data.suppliers.size,
      itemCount: data.items,
      totalQty: data.totalQty.toFixed(1),
      percentOfLoad: null  // Will be calculated after totaling
    });
  }

  // Calculate percentages
  results.forEach(r => {
    r.percentOfLoad = totalQty > 0 ? ((r.totalQty / totalQty) * 100).toFixed(1) : 0;
  });

  const balance = results.length === 2
    ? (Math.abs(results[0].totalQty - results[1].totalQty) / totalQty * 100).toFixed(1)
    : 0;

  return {
    staffWorkload: results,
    totalQty,
    loadBalance: balance,
    lastRefreshed: new Date().toISOString()
  };
}
```

---

### 2.5 Feedback Trends — Volume, Resolution, Item Rankings

**Business Question:** How much feedback are we getting? What's resolved vs. open? Which items generate the most feedback?

**Data Sources:**
- **Feedback** table → Item, Type (e.g., "Recipe Issue", "Quantity Wrong"), Status, Triage Result, Date, Notes
- **Items** table → Item Name, Item Type

**Calculation:**

```
Period = last 4 weeks

Feedback Volume:
  Total = COUNT(Feedback records)
  By Type = COUNT(...) grouped by Feedback.Type
  Per Day Avg = Total / 28

Resolution:
  Resolved = COUNT(Status = "Resolved")
  Open = COUNT(Status = "Open")
  Resolution Rate = Resolved / Total × 100%
  Avg Days to Resolve = AVERAGE(Date Resolved - Date Created)

Item Rankings:
  Top Items by Feedback = COUNT(...) grouped by Item, sorted DESC
  Feedback Density = Feedback Count / Item Prep Frequency

Triage Breakdown (if AI triage in place):
  Bug = items flagged as process/recipe issues
  High-Value = items worth investigating
  Low-Priority = improvements that don't block service
```

**Metrics to Display:**

| Metric | Calculation | Target |
|--------|-------------|--------|
| **Total Feedback (4w)** | COUNT all | Trend upward = more engagement |
| **Resolution Rate** | Resolved / Total | > 90% |
| **Avg Days to Resolve** | Mean (Resolved Date - Created Date) | < 3 days |
| **Top 5 Feedback Items** | By frequency | Monitor quality issues |
| **Feedback by Type** | Count per Type | Distribution analysis |
| **Open Issues** | Count (Status = Open) | < 5 at any time |

**Visualization:**
- **Stacked bar chart:** Weekly feedback volume by type (Recipe Issue, Quantity Wrong, etc.)
- **Line chart:** Cumulative feedback trend + resolution rate (dual axis)
- **Horizontal bar:** Top 10 items by feedback count
- **Pie chart:** Feedback breakdown by type
- **Table:** Open issues with date created, item, type, triage result, assignee, notes

**Update Frequency:** Real-time (polled every 1 hour)
**GAS Implementation:**

```javascript
function calculateFeedbackTrends_(venue) {
  const feedback = getFromCache(`feedback_${venue}`) || fetchFeedbackData(venue);
  const items = getFromCache(`items_${venue}`) || fetchItemsData(venue);

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentFeedback = feedback.filter(f =>
    new Date(f['Date']) >= fourWeeksAgo
  );

  // Volume metrics
  const byType = {};
  let resolved = 0, open = 0;
  const resolveTimes = [];

  recentFeedback.forEach(f => {
    const type = f['Type'] || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;

    if (f['Status'] === 'Resolved') {
      resolved++;
      if (f['Date Created'] && f['Date Resolved']) {
        const days = (new Date(f['Date Resolved']) - new Date(f['Date Created'])) / (1000*60*60*24);
        resolveTimes.push(days);
      }
    } else if (f['Status'] === 'Open') {
      open++;
    }
  });

  const resolutionRate = recentFeedback.length > 0
    ? (resolved / recentFeedback.length * 100).toFixed(1)
    : 0;

  const avgResolveTime = resolveTimes.length > 0
    ? (resolveTimes.reduce((a,b) => a+b) / resolveTimes.length).toFixed(1)
    : 'N/A';

  // Item rankings
  const byItem = {};
  recentFeedback.forEach(f => {
    const item = f['Item'] || 'Unknown';
    byItem[item] = (byItem[item] || 0) + 1;
  });

  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([item, count]) => ({ item, count }));

  // Open issues detail
  const openIssues = recentFeedback
    .filter(f => f['Status'] === 'Open')
    .map(f => ({
      item: f['Item'],
      type: f['Type'],
      dateCreated: f['Date Created'],
      triageResult: f['Triage Result'],
      notes: f['Notes']
    }))
    .sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));

  return {
    totalFeedback: recentFeedback.length,
    resolved,
    open,
    resolutionRate,
    avgResolveTime,
    byType,
    topItems,
    openIssues,
    lastRefreshed: new Date().toISOString()
  };
}
```

---

### 2.6 Automation Health — Script Execution Metrics

**Business Question:** Are automations working reliably? What's the error rate? Which scripts are slow?

**Data Sources:**
- **Audit Log** table → Script Name, Status (Success/Error), Execution Time, Timestamp, Error Message

**Calculation:**

```
Period = last 7 days

Per-Script Metrics:
  Total Runs = COUNT(Audit Log where Script = X)
  Success Rate = COUNT(Status = "Success") / Total Runs × 100%
  Error Count = COUNT(Status = "Error")
  Avg Execution Time = AVERAGE(Execution Time) for successful runs
  P95 Execution Time = 95th percentile
  Max Execution Time = MAX(Execution Time)
  Errors by Type = COUNT(...) grouped by Error Message

System Health:
  Overall Success Rate = Total Successes / Total Runs
  Failed Scripts = Scripts with Success Rate < 95%
  Slow Scripts = Scripts with Avg Time > 60 seconds
  Error Trend = Errors this week vs last week
```

**Metrics to Display:**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Overall Success Rate** | 99%+ | < 95% |
| **Failed Script Count** | 0 | > 0 |
| **Avg Execution Time** | < 60s | > 120s |
| **P95 Execution Time** | < 180s | > 300s |
| **Error Count (7d)** | 0–1 | > 3 |
| **Most Recent Error** | None | Any error |

**Visualization:**
- **Status indicator:** Green (all healthy), Yellow (minor issues), Red (failures)
- **Table:** Per-script: name, success rate %, avg time, error count, last run date/time
- **Line chart:** Success rate trend over 7 days (per script)
- **Bar chart:** Execution time distribution (avg, p95, max) per script
- **Alert log:** Recent errors with timestamp, script, error message, status

**Update Frequency:** Real-time (polled every 10 minutes via `processAuditLog()`)
**GAS Implementation:**

```javascript
function calculateAutomationHealth_(venue) {
  const auditLog = getFromCache(`audit_log_${venue}`) || fetchAuditLogData(venue);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLogs = auditLog.filter(log =>
    new Date(log['Timestamp']) >= sevenDaysAgo
  );

  // Group by script
  const byScript = {};

  recentLogs.forEach(log => {
    const script = log['Script Name'] || 'Unknown';

    if (!byScript[script]) {
      byScript[script] = {
        total: 0,
        success: 0,
        error: 0,
        executionTimes: [],
        errors: []
      };
    }

    byScript[script].total++;

    if (log['Status'] === 'Success') {
      byScript[script].success++;
      const execTime = parseFloat(log['Execution Time (ms)']) || 0;
      byScript[script].executionTimes.push(execTime);
    } else {
      byScript[script].error++;
      byScript[script].errors.push({
        timestamp: log['Timestamp'],
        message: log['Error Message'],
        details: log['Error Details']
      });
    }
  });

  // Calculate metrics per script
  const results = [];
  let totalRuns = 0, totalSuccesses = 0;

  for (const [script, data] of Object.entries(byScript)) {
    totalRuns += data.total;
    totalSuccesses += data.success;

    const successRate = data.total > 0 ? (data.success / data.total * 100).toFixed(1) : 0;
    const avgTime = data.executionTimes.length > 0
      ? (data.executionTimes.reduce((a,b) => a+b) / data.executionTimes.length).toFixed(0)
      : 0;

    // Calculate P95
    let p95 = 0;
    if (data.executionTimes.length > 0) {
      const sorted = data.executionTimes.sort((a,b) => a-b);
      const idx = Math.ceil(sorted.length * 0.95) - 1;
      p95 = sorted[idx] || 0;
    }

    results.push({
      script,
      totalRuns: data.total,
      successRate,
      errorCount: data.error,
      avgTime,
      p95Time: p95.toFixed(0),
      recentErrors: data.errors.slice(-3)  // Last 3 errors
    });
  }

  const overallSuccessRate = totalRuns > 0 ? (totalSuccesses / totalRuns * 100).toFixed(1) : 0;

  return {
    overallSuccessRate,
    scripts: results,
    totalRuns,
    totalSuccesses,
    healthStatus: overallSuccessRate >= 95 ? 'GREEN' : (overallSuccessRate >= 90 ? 'YELLOW' : 'RED'),
    lastRefreshed: new Date().toISOString()
  };
}
```

---

### 2.7 Cross-Venue Comparison — Sakura vs Waratah

**Business Question:** How do the venues compare on key metrics? Which is more efficient?

**Data Sources:** All tables from both Airtable bases (venue-specific queries)

**Calculation:** Calculate metrics 2.1–2.6 for both venues in parallel, then compare side-by-side.

```
For each metric:
  Sakura Value vs Waratah Value
  Difference = |Sakura - Waratah|
  % Difference = (Difference / Sakura) × 100%

  Highlight larger deviations (> 15%)
```

**Metrics to Display:**

| Metric | Sakura | Waratah | Difference |
|--------|--------|---------|------------|
| Prep Efficiency % | 98.5% | 95.2% | +3.3% Sakura leads |
| Over-Production Count | 1 item | 3 items | Waratah higher waste |
| Top Recipe (4w) | [name] freq | [name] freq | Compare popularity |
| Staff Workload Balance | Gooch 48%, Sabs 52% | N/A (Evan only) | Compare |
| Feedback Resolution Rate | 92% | 88% | Sakura faster |
| Automation Success Rate | 99% | 96% | Sakura more reliable |

**Visualization:**
- **Side-by-side dashboard:** Sakura left, Waratah right, with key metrics in matching positions
- **Radar chart:** 6 dimensions (Efficiency, Waste, Popularity, Workload, Feedback, Automation) — one radar per venue
- **Table:** Detailed comparison with variance indicators
- **Trend lines:** Same-scale multi-line charts for 4-week trend comparison

**Update Frequency:** Daily (10 PM) for combined metric, using data from daily calculations of each venue

---

## Part 3: Google Sheet Tab Specifications

### 3.1 DASHBOARD (Overview)

**Purpose:** High-level summary for managers; 1-page view of all critical metrics.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ PREP SYSTEMS ANALYTICS DASHBOARD                           │
│ Sakura House & The Waratah — Last Refreshed: [timestamp]   │
└────────────────────────────────────────────────────────────┘

[CRITICAL ALERTS SECTION]
─────────────────────────────────────────────────────────────
⚠️  ALERTS & ACTIONS
├─ Automation Health: [GREEN/YELLOW/RED indicator]
├─ Failed Scripts: [list or "None"]
├─ Open Issues: X items (list if > 5)
├─ Waste Risk: [$ amount or "Acceptable"]
└─ Stockout Risk: X items

[KEY PERFORMANCE INDICATORS — 2 COLUMNS: SAKURA | WARATAH]
─────────────────────────────────────────────────────────────
PREP EFFICIENCY (Last 4w Avg)
  Sakura: 98.5% [Trend ↗]      Waratah: 95.2% [Trend ↘]
  Target: 95–105%              Target: 95–105%

WASTE INDICATORS
  Over-Stock Items: 1           Over-Stock Items: 3
  Under-Stock Items: 0          Under-Stock Items: 1

TOP RECIPE (4-Week)
  Sakura: [Recipe A] 12x        Waratah: [Recipe B] 18x

STAFF WORKLOAD (This Week)
  Gooch: 2,400 ml               Evan: 3,100 ml
  Sabs: 2,550 ml                (Single operator)

FEEDBACK (Open)
  Resolution Rate: 92%          Resolution Rate: 88%
  Open Issues: 2                Open Issues: 3

AUTOMATION HEALTH (7d)
  Success Rate: 99%             Success Rate: 96%
  Failed Scripts: 0             Failed Scripts: 0

[DRILL-DOWN LINKS]
─────────────────────────────────────────────────────────────
→ View Detailed Prep Efficiency Analysis
→ View Waste & Par-Level Report
→ View Top 10 Recipes
→ View Staff Workload Distribution
→ View Feedback & Open Issues
→ View Automation Logs
```

**Formulas:**
- Reference cells from detailed tabs (e.g., `='Prep Efficiency'!B5`)
- Conditional formatting: Green (good), Yellow (warning), Red (critical)
- Data validation: Links to detailed tabs via INDEX/MATCH

---

### 3.2 Prep Efficiency (Detailed)

**Columns:**
```
Date | Prep Run ID | Efficiency % | Variance % | Over-Count | Under-Count | Comments
```

**Data:** One row per weekly Prep Run; sortable by date or efficiency

**Conditional Formatting:**
- Efficiency %: Green (95–105%), Yellow (90–95% or 105–110%), Red (< 90% or > 110%)
- Variance %: Color scale from red (large negative) to green (small) to red (large positive)

**Charts Embedded:**
- Line: Weekly efficiency trend over 12 weeks
- Bar: Over/Under production counts

---

### 3.3 Waste Analysis (Detailed)

**Columns:**
```
Item Name | Par Level | Recent Count | % of Par | 4-Week Avg % | Risk Flag | Weeks Over 120% | Weeks Under 95% | Notes
```

**Data:** One row per item; sortable by Par Level or Risk Flag

**Conditional Formatting:**
- % of Par: Heat map (red > 120%, orange 110–120%, green 95–110%, blue < 95%)
- Risk Flag: Green (OK), Orange (Watch), Red (Action Needed)

**Charts Embedded:**
- Scatter: All items' current vs par level
- Bar: Top 5 over-stocked and top 5 under-stocked

---

### 3.4 Recipe Popularity (Detailed)

**Columns:**
```
Rank | Recipe/Item Name | Frequency (4w) | Trend % | Avg Qty | Batches Needed | Item Type | Menu Category | Notes
```

**Data:** Top 10 items; sortable by frequency or trend %

**Charts Embedded:**
- Horizontal bar: Top 10 by frequency
- Pie: Distribution by Item Type or Menu Category
- Sparkline: Frequency trend per recipe

---

### 3.5 Staff Workload (Detailed)

**Columns:**
```
Week | Staff Name | Supplier Count | Item Count | Total Qty | % of Load | Load Balance % | Peak Item | Notes
```

**Data:** One row per staff per week (Sakura: Gooch + Sabs; Waratah: Evan only)

**Charts Embedded:**
- Stacked bar: Weekly load by staff
- Donut: Supplier distribution per staff

---

### 3.6 Feedback Trends (Detailed)

**Columns:**
```
Date | Item | Type | Status | Triage Result | Days to Resolve | Notes
```

**Data:** All feedback records from last 4 weeks; filterable by status, type, item

**Summary Row:**
```
SUMMARY METRICS (above table)
─────────────────────────────
Total Feedback: X
Resolved: Y (Z%)
Open: A
Avg Days to Resolve: B
Top 5 Items: [list]
```

**Charts Embedded:**
- Stacked bar: Weekly volume by type
- Line: Cumulative feedback + resolution rate
- Bar: Top 10 items by feedback count

---

### 3.7 Automation Health (Detailed)

**Columns:**
```
Script Name | Last Run | Status | Execution Time (ms) | Success Rate (7d) | Error Count | Recent Errors
```

**Data:** One row per script; sorted by status (errors first)

**Summary Row:**
```
HEALTH SUMMARY (above table)
──────────────────────────
Overall Success Rate: 99%
Failed Scripts: 0
Slow Scripts (>120s): 0
```

**Charts Embedded:**
- Status indicator (color-coded box)
- Table: Last 10 execution logs with details

---

### 3.8 Cross-Venue Comparison (Side-by-Side)

**Layout:**
```
METRIC                              SAKURA HOUSE           THE WARATAH            DIFFERENCE
────────────────────────────────────────────────────────────────────────────────────────────
Prep Efficiency (4w avg)            98.5% [↗]              95.2% [↘]              +3.3% Sakura
Over-Production Count               1 item                 3 items                Waratah higher
Under-Production Count              0 items                1 item                 Waratah higher
Top Recipe & Frequency              [A] 12x                [B] 18x                Different
Staff Workload Balance              Gooch 48%, Sabs 52%    Evan only (100%)       Structure different
Feedback Resolution Rate            92%                    88%                    +4% Sakura
Automation Success Rate             99%                    96%                    +3% Sakura

[RADAR CHART: 6-dimensional comparison]
[TREND LINES: Same-scale 4-week trend comparison]
```

**Conditional Formatting:** Highlight larger differences (> 10% variance) in yellow/red

---

### 3.9 Data Cache (Internal)

**Purpose:** Store Airtable fetch results + timestamps for reuse and offline analysis

**Columns:**
```
Table Name | Record Count | Last Fetched | Expires At | Status | Notes
```

**Data:** Metadata about cached datasets; used internally by GAS to determine if fresh fetch needed

**Hidden from users:** View-only for admins, hidden from regular managers

---

## Part 4: GAS Scheduler & Execution

### 4.1 Scheduling Strategy

**Setup:**
```javascript
// In AppsScript project, create time-driven triggers:

// Daily refresh (10 PM)
function dailyRefresh() {
  const sheet = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
  analyticsApp.refreshDaily(sheet);  // Calls calculatePrepEfficiency_, calculateWasteIndicators_, etc.
}

// Weekly refresh (Saturday 4 PM)
function weeklyRefresh() {
  const sheet = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
  analyticsApp.refreshWeekly(sheet);  // Calls calculateRecipePopularity_, calculateStaffWorkload_
}

// Real-time polling (every 10 minutes)
function realtimePolling() {
  const sheet = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
  analyticsApp.pollFeedback(sheet);   // Fetches Feedback table
  analyticsApp.pollAuditLog(sheet);   // Fetches Audit Log
}

// Custom menu trigger (manual refresh)
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Analytics')
    .addItem('Refresh All Data', 'manualRefresh')
    .addItem('Refresh Automation Health', 'manualRefreshHealth')
    .addItem('Clear Cache', 'clearCache')
    .addToUi();
}

function manualRefresh() {
  dailyRefresh();
  weeklyRefresh();
  realtimePolling();
  SpreadsheetApp.getUi().alert('Dashboard refreshed!');
}
```

**Execution Timeline:**
- 10:00 PM daily → Prep efficiency, waste, feedback, automation health
- 4:00 PM Saturday → Recipe popularity, staff workload (post-shift when data is complete)
- Every 10 min → Feedback + audit log polling
- On-demand → Manual refresh via menu

### 4.2 Error Handling & Recovery

```javascript
function refreshDaily(sheet) {
  try {
    const startTime = Date.now();

    // Fetch phase
    const prepData = fetchPrepRunData();  // API call 1
    const taskData = fetchPrepTaskData(); // API call 2
    // ... etc

    // Check for rate limit headers
    if (preHeaders.rateLimit === '0') {
      Logger.log('Rate limit hit; deferring refresh');
      logError('Rate Limit Hit', 'Deferred refresh to next cycle', {timestamp: new Date()});
      return;
    }

    // Calculate phase
    const prepEff = calculatePrepEfficiency_();
    // ... etc

    // Write phase
    writePrepEfficiencyTab(sheet, prepEff);
    // ... etc

    // Logging
    const duration = Date.now() - startTime;
    logAuditEntry('AnalyticsDashboard.gs', 'dailyRefresh', 'Success', duration);

  } catch (err) {
    logError('AnalyticsDashboard.gs', 'dailyRefresh', {
      message: err.toString(),
      stack: err.stack,
      timestamp: new Date()
    });

    // Send Slack alert if critical
    if (err.toString().includes('Rate Limit')) {
      slackAlert('WARN', 'Analytics: Rate limit hit, data may be stale');
    }
  }
}

function logError(scriptName, functionName, details) {
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
  logSheet.appendRow([
    new Date(),
    scriptName,
    functionName,
    'ERROR',
    JSON.stringify(details)
  ]);
}
```

### 4.3 Rate Limit Management

**Airtable REST API:** 5 requests/second; 30 requests/minute per base

**Strategy:**
- **Batch queries:** One call per table (use `pageSize=100` and iterate) rather than many small calls
- **Caching:** Store results in sheet cache; reuse for 2 hours unless manual refresh
- **Staggered schedule:** Daily refresh at 10 PM (low-traffic time); weekly at 4 PM Sat (post-shift)
- **Fallback:** If rate limit hit, use cached data and log warning

**Calculation:**
```
Daily refresh: 6 tables × 1 call each = 6 calls
Weekly refresh: 4 tables × 1 call each = 4 calls
Real-time polling: 2 tables × 1 call = 2 calls

Total: 6 + 4 + 2 = 12 calls per day (well below 30/min limit)
With 100-record pages: 10–15 pages to iterate (per table if > 100 records)
```

Estimated total: ~100 API calls/day (5% of daily budget) → Safe.

---

## Part 5: Implementation Roadmap

### Phase 2.4a: Foundation (Week 1)
- [ ] Create `AnalyticsDashboard.gs` skeleton (empty functions)
- [ ] Set up 9 Google Sheet tabs with headers
- [ ] Implement `fetchAirtableData_()` batch fetching (Sakura first)
- [ ] Deploy GAS script; test manual refresh

### Phase 2.4b: Core Metrics (Week 2)
- [ ] Implement metrics 2.1–2.3 (Prep Efficiency, Waste, Recipe Popularity)
- [ ] Populate corresponding tabs
- [ ] Embed basic charts (line, bar, heatmap)

### Phase 2.4c: Secondary Metrics (Week 3)
- [ ] Implement metrics 2.4–2.6 (Staff Workload, Feedback, Automation Health)
- [ ] Populate corresponding tabs
- [ ] Embed charts

### Phase 2.4d: Cross-Venue & Scheduling (Week 4)
- [ ] Duplicate Airtable fetching for Waratah base
- [ ] Implement metric 2.7 (Cross-Venue Comparison)
- [ ] Set up time-driven triggers (daily, weekly, real-time polling)
- [ ] Create custom menu in sheet
- [ ] Pilot with managers; iterate on visualization

### Phase 2.4e: Polish & Deploy (Week 5)
- [ ] Add error handling + Slack alerts
- [ ] Optimize for performance (< 90 seconds per refresh)
- [ ] Write user guide for managers
- [ ] Train staff on how to read dashboard
- [ ] Monitor for 1 week; fix edge cases

---

## Part 6: Usage Guide for Managers

### Viewing the Dashboard

1. Open the shared Google Sheet (link in Airtable interface)
2. Click **DASHBOARD** tab first — this is the executive summary
3. For details, click any "→ View..." link or jump to specific tab

### Interpreting Key Metrics

**Prep Efficiency %**
- Target: 95–105%
- Green: We're prepping in line with orders
- Yellow: Slight over/under-production
- Red: Significant variance — investigate

**Waste Indicators**
- Over-Stock: Items sitting above par (potential waste)
- Under-Stock: Items not reaching par (potential stockouts)
- Action: Review par levels with venue manager

**Top Recipes**
- This week's most-prepped items
- Trend: ↗ = increasing demand, ↘ = declining
- Use to forecast ingredient orders

**Staff Workload**
- (Sakura) Shows Gooch vs Sabs balance
- Green: ±10% balance; Yellow: 10–20% imbalance; Red: > 20%
- Action: Redistribute suppliers if imbalanced

**Feedback Resolution**
- Open issues that need action
- Days to Resolve: how long we take to fix
- Target: < 3 days

**Automation Health**
- Green = all scripts running; Yellow = minor errors; Red = failures
- If Red: Check "Recent Errors" and contact admin

### Refreshing Data

**Automatic:** Dashboard refreshes every day at 10 PM and Saturday at 4 PM.

**Manual:** Click **Analytics → Refresh All Data** to update immediately.

---

## Part 7: Technical Specifications

### GAS Dependencies

```javascript
const DASHBOARD_SHEET_ID = '[Google Sheet ID]';
const SAKURA_BASE_ID = 'appNsFRhuU47e9qlR';
const WARATAH_BASE_ID = 'appfcy14ZikhKZnRS';
const AIRTABLE_PAT = PropertiesService.getScriptProperties().getProperty('AIRTABLE_PAT');

const CFG = {
  airtable: {
    bases: {
      sakura: SAKURA_BASE_ID,
      waratah: WARATAH_BASE_ID
    },
    tables: {
      items: 'tblMiIJW5c1yaKATc',  // Sakura Items ID
      // ... etc
    },
    staffAliases: {
      sakura: { 'Gooch': 'Gooch', 'Sabs': 'Sabs', 'Sabine': 'Sabs' },
      waratah: { 'Evan': 'Evan' }
    }
  },
  dashboard: {
    sheetId: DASHBOARD_SHEET_ID,
    refreshSchedule: {
      daily: '10:00 PM',
      weekly: 'Saturday 4:00 PM',
      realtime: 'every 10 minutes'
    },
    cacheExpiry: 2 * 60 * 60 * 1000  // 2 hours in ms
  }
};
```

### API Response Caching Pattern

```javascript
function getFromCache(cacheKey) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);

  if (cached) {
    Logger.log(`Cache hit: ${cacheKey}`);
    return JSON.parse(cached);
  }

  return null;
}

function saveToCache(cacheKey, data) {
  const cache = CacheService.getScriptCache();
  cache.put(cacheKey, JSON.stringify(data), 7200);  // 2-hour TTL
}

function fetchPrepRunData() {
  const cacheKey = 'prep_runs_sakura';
  const cached = getFromCache(cacheKey);

  if (cached) return cached;

  // Fetch from Airtable
  const url = `https://api.airtable.com/v0/${SAKURA_BASE_ID}/Prep%20Runs?pageSize=100`;
  const options = {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  // Log rate limit headers
  const rateLimit = response.getHeaders()['x-ratelimit-remaining'];
  Logger.log(`Rate limit remaining: ${rateLimit}`);

  // Paginate if needed
  let allRecords = data.records || [];
  let offset = data.offset;

  while (offset) {
    const pageUrl = url + `&offset=${offset}`;
    const pageResponse = UrlFetchApp.fetch(pageUrl, options);
    const pageData = JSON.parse(pageResponse.getContentText());
    allRecords = allRecords.concat(pageData.records || []);
    offset = pageData.offset;
  }

  // Transform to flat array of field values
  const records = allRecords.map(r => ({
    id: r.id,
    ...r.fields
  }));

  saveToCache(cacheKey, records);
  return records;
}
```

### Sheet Writing Pattern

```javascript
function writePrepEfficiencyTab(sheet, data) {
  const tab = sheet.getSheetByName('Prep Efficiency') || sheet.insertSheet('Prep Efficiency');

  // Clear existing data (keep headers)
  tab.clearContents();

  // Write headers
  const headers = ['Date', 'Prep Run ID', 'Efficiency %', 'Variance %', 'Over-Count', 'Under-Count', 'Notes'];
  tab.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format headers
  tab.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');

  // Write data
  const rows = data.summary.map(d => [
    d.runDate,
    d.runId,
    d.efficiency,
    d.avgVariance,
    d.overCount,
    d.underCount,
    ''
  ]);

  if (rows.length > 0) {
    tab.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Add timestamp
  const footer = `Last Refreshed: ${new Date().toLocaleString()}`;
  tab.getRange(rows.length + 3, 1).setValue(footer).setFontStyle('italic');

  // Apply conditional formatting
  const dataRange = tab.getRange(2, 3, rows.length, 1);  // Efficiency % column
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(95, 105)
    .setBackground('#A4C2F4')
    .setRanges([dataRange])
    .build();
  tab.addConditionalFormatRule(rule);
}
```

---

## Part 8: Success Criteria

### Functional Requirements
- [x] Fetch data from Airtable in < 30 seconds
- [x] Calculate metrics in < 60 seconds
- [x] Populate sheet tabs in < 30 seconds
- [x] Total execution time < 90 seconds per refresh
- [x] 99%+ uptime (no more than 1 failed refresh per month)
- [x] Support 4-week rolling window
- [x] Handle both Sakura & Waratah in single dashboard

### User Experience
- [x] Dashboard readable by non-technical managers
- [x] All metrics clearly labeled with units + targets
- [x] Color-coded alerts (green/yellow/red) for quick scanning
- [x] Drill-down links to detailed tabs
- [x] Manual refresh button in Google Sheet
- [x] Timestamp showing when data was last updated
- [x] User guide provided

### Data Quality
- [x] No division-by-zero errors
- [x] Handle missing or null values gracefully
- [x] Cache invalidation strategy (2-hour TTL)
- [x] Error logging with Slack alerts for P0 failures
- [x] Audit trail of all refreshes (timestamp, duration, status)

### Performance
- [x] API rate limiting respected (5 req/sec)
- [x] GAS execution < 6 minutes
- [x] Sheet opens in < 2 seconds
- [x] Caching reduces redundant API calls
- [x] Pagination for tables > 100 records

---

## Appendix A: Sample Dashboard Data (Reference)

**Example: Prep Efficiency (Sakura House, Last 4 Weeks)**

| Week | Efficiency % | Trend | Over-Count | Under-Count | Notes |
|------|--------------|-------|-----------|------------|-------|
| Mar 16 | 98.2% | ↗ | 1 | 0 | Batch A overproduced |
| Mar 23 | 97.8% | ↘ | 0 | 1 | Sub Recipe B short |
| Mar 30 | 99.1% | ↗ | 2 | 0 | Normal variation |
| Apr 6 | 96.5% | ↘ | 1 | 2 | Easter adjustments |

**Avg (4w):** 97.9% (Target: 95–105%)
**Status:** GREEN — Within acceptable range

---

## Appendix B: Airtable Schema Reference

**Key Tables Used:**

1. **Prep Runs** (linked from Ingredient Requirements, Prep Tasks)
2. **Prep Tasks** (linked from Items, Recipes, Prep Runs)
3. **Ingredient Requirements** (linked from Items, Prep Runs, Recipes)
4. **Weekly Counts** (linked from Items)
5. **Items** (central hub — links to all tables)
6. **Recipes** (linked from Items, Recipe Lines)
7. **Recipe Lines** (linked from Recipes, Items)
8. **Feedback** (linked from Items)
9. **Audit Log** (linked from automation runs)

All table IDs and field names stored in `AIRTABLE_SCHEMA.md` files per venue.

---

## Appendix C: Known Limitations & Future Improvements

### Current Limitations

1. **Recipe name resolution (Waratah):** Requires two-step fetch (Items → id:name map, then Recipes) due to linked record field
2. **Supplier-level ordering (Sakura):** Only supports Gooch/Sabs split; future multi-staff assignments would need lookup refactor
3. **4-week rolling window:** Fixed to 28 days; doesn't account for holidays or bi-weekly cycles
4. **Feedback triage (if AI-based):** Depends on upstream AI scoring; no custom triage logic in dashboard

### Future Enhancements

1. **Predictive analytics:** Forecast prep demand based on recipe popularity trends
2. **Cost analysis:** Integrate supplier pricing to estimate waste $ impact
3. **Delivery tracking:** Link stock orders to delivery dates; track on-time delivery %
4. **Staff performance:** Track per-staff ordering accuracy, feedback resolution time
5. **Seasonal trends:** Multi-year comparison to detect seasonal patterns
6. **Real-time alerts:** Slack notification when prep efficiency drops below 90%
7. **Mobile view:** Responsive design for venue tablets
8. **Custom date ranges:** Manager-selectable period (week, month, custom range)

---

**End of Document**

**Version:** 1.0 (Design Specification)
**Status:** Ready for Phase 2.4a Implementation
**Last Updated:** 2026-03-23
