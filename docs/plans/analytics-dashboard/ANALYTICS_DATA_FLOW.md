# Analytics Dashboard — Data Flow & Query Reference

**Purpose:** Detailed breakdown of data sources, transformations, and calculations for each metric
**Audience:** Developers implementing the dashboard
**Status:** Complete specification

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AIRTABLE BASES (Data Source)                 │
│  ┌─────────────────┐              ┌──────────────────────┐      │
│  │ Sakura House    │              │   The Waratah        │      │
│  │ appNsFRhuU...   │              │ appfcy14Zikh...      │      │
│  ├─────────────────┤              ├──────────────────────┤      │
│  │ • Items         │              │ • Items              │      │
│  │ • Recipes       │              │ • Recipes            │      │
│  │ • Prep Tasks    │              │ • Prep Tasks         │      │
│  │ • Ingredient Reqs│              │ • Ingredient Reqs    │      │
│  │ • Weekly Counts │              │ • Stock Counts       │      │
│  │ • Feedback      │              │ • Count Sessions     │      │
│  │ • Audit Log     │              │ • Feedback           │      │
│  │ • Prep Runs     │              │ • Audit Log          │      │
│  └─────────────────┘              │ • Prep Runs          │      │
│                                   └──────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                           ▼
        ┌──────────────────────────────────────────┐
        │  Airtable REST API (via AIRTABLE_PAT)   │
        │  • 5 req/sec max                        │
        │  • Batch fetching (pageSize=100)        │
        │  • Filtered queries (filterByFormula)    │
        └──────────────────────────────────────────┘
                           ▼
        ┌──────────────────────────────────────────┐
        │  Google Apps Script (AnalyticsDashboard) │
        │                                          │
        │  Phase 1: Data Fetching & Caching       │
        │  ├─ fetchAirtableTable_()                │
        │  ├─ getOrFetch_() [cache logic]          │
        │  └─ fetchAllData_(venue)                 │
        │                                          │
        │  Phase 2: Calculations                  │
        │  ├─ calculatePrepEfficiency_()           │
        │  ├─ calculateWasteIndicators_()          │
        │  ├─ calculateRecipePopularity_()         │
        │  ├─ calculateStaffWorkload_()            │
        │  ├─ calculateFeedbackTrends_()           │
        │  └─ calculateAutomationHealth_()         │
        │                                          │
        │  Phase 3: Sheet Writing                 │
        │  ├─ writePrepEfficiencyTab_()            │
        │  ├─ writeWasteAnalysisTab_()             │
        │  └─ ... [6 more write functions]         │
        │                                          │
        │  Phase 4: Orchestration                 │
        │  ├─ dailyRefresh()  [10 PM daily]        │
        │  ├─ weeklyRefresh() [Sat 4 PM]           │
        │  └─ manualRefresh() [on-demand]          │
        └──────────────────────────────────────────┘
                           ▼
        ┌──────────────────────────────────────────┐
        │   Google Sheet Analytics Dashboard      │
        │                                          │
        │  DASHBOARD ──────► Overview + alerts     │
        │  Prep Efficiency ─► Weekly variance      │
        │  Waste Analysis ──► Par-level tracking   │
        │  Recipe Popularity► Top 10 items         │
        │  Staff Workload ──► Load distribution    │
        │  Feedback Trends ─► Resolution rates     │
        │  Automation Health► Script success       │
        │  Cross-Venue ─────► Sakura vs Waratah    │
        │  Data Cache ──────► Internal metadata    │
        └──────────────────────────────────────────┘
```

---

## Metric 1: Prep Efficiency

### Business Question
What percentage of ordered items were prepared? Are we over/under-producing?

### Data Sources

| Table | Field | Purpose | Link |
|-------|-------|---------|------|
| Ingredient Requirements | Item, Quantity Ordered, Prep Run | What was ordered | Prep Run → Prep Runs |
| Prep Tasks | Item, Quantity, Prep Run | What was prepared | Prep Run → Prep Runs |
| Prep Runs | Date, Status | Time period | Parent table |

### Query Flow

```
1. Fetch Prep Runs (last 4 weeks)
   SELECT id, Date FROM Prep Runs WHERE Date >= NOW() - 28 days
   SORT BY Date DESC

2. For each Prep Run ID:
   a. Fetch Ingredient Requirements
      SELECT Item, Quantity Ordered FROM Ingredient Requirements
      WHERE Prep Run = <Run ID>

   b. Fetch Prep Tasks
      SELECT Item, Quantity FROM Prep Tasks
      WHERE Prep Run = <Run ID>

3. Group both by Item name, sum quantities

4. Calculate variance per item:
   Variance % = ((Prepared - Ordered) / Ordered) × 100
```

### Calculation Logic

```javascript
function calculatePrepEfficiency_(venue, data) {
  // Loop: for each prep run in last 4 weeks
  for (const run of prepRuns) {
    // Step 1: Group ingredient requirements by item
    const orderedByItem = {};
    ingredientReqs.forEach(ir => {
      if (ir.prepRun === run.id) {
        orderedByItem[ir.item] = orderedByItem[ir.item] || 0;
        orderedByItem[ir.item] += ir.quantityOrdered;
      }
    });

    // Step 2: Group prep tasks by item
    const preparedByItem = {};
    prepTasks.forEach(pt => {
      if (pt.prepRun === run.id) {
        preparedByItem[pt.item] = preparedByItem[pt.item] || 0;
        preparedByItem[pt.item] += pt.quantity;
      }
    });

    // Step 3: Calculate variance per item
    let totalOrdered = 0, totalPrepared = 0;
    let overCount = 0, underCount = 0;
    const variances = [];

    for (const item in orderedByItem) {
      const ordered = orderedByItem[item];
      const prepared = preparedByItem[item] || 0;

      totalOrdered += ordered;
      totalPrepared += prepared;

      const variance = (prepared - ordered) / ordered * 100;
      variances.push(variance);

      if (prepared > ordered * 1.10) overCount++;        // Over 10%
      if (prepared < ordered * 0.90) underCount++;       // Under 10%
    }

    // Step 4: Aggregate to run level
    const runEfficiency = totalOrdered > 0
      ? (totalPrepared / totalOrdered) * 100
      : 0;

    const avgVariance = variances.length > 0
      ? variances.reduce((a,b) => a+b) / variances.length
      : 0;

    results.push({
      date: run.date,
      runId: run.id,
      efficiency: runEfficiency,      // e.g., 97.3%
      avgVariance: avgVariance,       // e.g., +2.1%
      overCount,                       // Items prepped > 110%
      underCount                       // Items prepped < 90%
    });
  }

  return results;
}
```

### Metrics Output

| Metric | Formula | Type | Example |
|--------|---------|------|---------|
| Efficiency % | SUM(Prepared) / SUM(Ordered) × 100 | % | 97.8% |
| Avg Variance % | AVERAGE(item variances) | % | +1.2% |
| Over-Count | COUNT(items where Prepared > Ordered × 1.10) | # | 2 items |
| Under-Count | COUNT(items where Prepared < Ordered × 0.90) | # | 1 item |
| Consistency Trend | 4-week rolling average efficiency | % | 97.2% (↗) |

### Key Assumptions

- Ingredient Requirements.Quantity Ordered = exact amount to order
- Prep Tasks.Quantity = exact amount prepared
- Both use same unit (ml, g, or each)
- One prep run per week (Sakura: Sat; Waratah: Mon)

### Validation Checks

- [ ] Ordered qty > 0 (avoid divide-by-zero)
- [ ] Prepared qty >= 0 (can't be negative)
- [ ] Dates are within last 4 weeks
- [ ] Item names match between tables (case-sensitive)

---

## Metric 2: Waste Indicators

### Business Question
Which items consistently sit above par (waste risk)? Which never reach par (stockout risk)?

### Data Sources

| Table | Field | Purpose |
|-------|-------|---------|
| Items | Item Name, Par Level, Weekly Volume | Target inventory |
| Weekly Counts | Item, Quantity, Date, Confirmed | Actual stock level |

### Query Flow

```
1. Fetch all Items (active)
   SELECT Item Name, Par Level FROM Items WHERE Active = true

2. For each Item:
   a. Fetch Weekly Counts (last 4 weeks, confirmed only)
      SELECT Quantity, Date FROM Weekly Counts
      WHERE Item = <Item Name> AND Confirmed = true AND Date >= NOW() - 28 days
      SORT BY Date DESC

   b. For each count, calculate % of par:
      Percent of Par = (Quantity / Par Level) × 100

   c. Count weeks where:
      • > 120% par (over-stock)
      • < 95% par (under-stock)

3. Classify risk:
   OVER-STOCK if >= 3 weeks over 120%
   UNDER-STOCK if >= 3 weeks under 95%
   OK otherwise
```

### Calculation Logic

```javascript
function calculateWasteIndicators_(venue, data) {
  const results = [];

  for (const item of items) {
    const itemName = item['Item Name'];
    const parLevel = item['Par Level'];

    // Fetch recent counts for this item
    const recentCounts = weeklyCounts.filter(wc =>
      wc['Item'] === itemName &&
      wc['Confirmed'] === true &&
      isWithin4Weeks(wc['Date'])
    );

    if (recentCounts.length === 0) continue;  // Skip if no data

    // Track weeks above/below par
    let overWeeks = 0, underWeeks = 0;
    const percentList = [];

    for (const count of recentCounts) {
      const countQty = count['Quantity'];
      const percentOfPar = (countQty / parLevel) * 100;

      percentList.push(percentOfPar);

      if (percentOfPar > 120) overWeeks++;
      if (percentOfPar < 95) underWeeks++;
    }

    // Average % of par
    const avgPercent = percentList.length > 0
      ? percentList.reduce((a,b) => a+b) / percentList.length
      : 0;

    // Determine risk flag
    let riskFlag = 'OK';
    if (overWeeks >= 3) riskFlag = 'OVER-STOCK';
    else if (underWeeks >= 3) riskFlag = 'UNDER-STOCK';

    results.push({
      itemName,
      parLevel,
      overWeeks,
      underWeeks,
      avgPercentOfPar: avgPercent,
      riskFlag,
      dataPoints: recentCounts.length
    });
  }

  return results;
}
```

### Metrics Output

| Metric | Calculation | Risk Threshold |
|--------|-------------|-----------------|
| Over-Stock Items | COUNT(where ≥3 weeks > 120% par) | > 2 items |
| Under-Stock Items | COUNT(where ≥3 weeks < 95% par) | > 1 item |
| Par Achievement % | Items reaching par / total | < 90% |
| Avg % of Par | Mean of all items' par %s | Target 100–105% |

### Key Assumptions

- Par Level is the target inventory quantity
- Weekly Counts are done on same day each week (e.g., Sat morning)
- "Confirmed" flag means count is validated (not draft)
- 4-week window = recent past (not seasonal patterns)

### Validation Checks

- [ ] Par Level > 0 (required)
- [ ] At least 2 data points per item (4-week window)
- [ ] Quantity >= 0 (no negative counts)
- [ ] Item status = Active

---

## Metric 3: Recipe Popularity

### Business Question
Which recipes are prepped most often? What's the trend?

### Data Sources

| Table | Field | Purpose |
|-------|-------|---------|
| Prep Tasks | Item, Quantity, Date | Every prep action |
| Items | Item Name, Item Type | Metadata |
| Recipes | Item Name, Recipe ID | Definition |

### Query Flow

```
1. Fetch Prep Tasks (last 4 weeks)
   SELECT Item, Quantity, Date FROM Prep Tasks
   WHERE Date >= NOW() - 28 days
   SORT BY Date DESC

2. Group by Item:
   For each unique Item:
   a. COUNT prep task records = Frequency
   b. SUM quantities = Total Qty
   c. Avg Qty = Total Qty / Frequency

3. Sort by Frequency DESC, take top 10

4. Enrich with metadata:
   - Look up Item Type from Items table
   - Look up Recipe ID from Recipes table
```

### Calculation Logic

```javascript
function calculateRecipePopularity_(venue, data) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const itemFrequency = {};

  // Group prep tasks by item
  for (const task of prepTasks) {
    const taskDate = new Date(task['Date']);
    if (taskDate < fourWeeksAgo) continue;  // Skip old tasks

    const itemName = task['Item'];

    if (!itemFrequency[itemName]) {
      itemFrequency[itemName] = {
        frequency: 0,
        totalQty: 0
      };
    }

    itemFrequency[itemName].frequency++;
    itemFrequency[itemName].totalQty += task['Quantity'];
  }

  // Convert to array and enrich
  const enriched = [];

  for (const [itemName, stats] of Object.entries(itemFrequency)) {
    const item = items.find(i => i['Item Name'] === itemName);
    const recipe = recipes.find(r => r['Item Name'] === itemName);

    enriched.push({
      itemName,
      frequency: stats.frequency,
      totalQty: stats.totalQty,
      avgQty: stats.totalQty / stats.frequency,
      itemType: item ? item['Item Type'] : 'Unknown',
      recipeId: recipe ? recipe['Recipe ID'] : null
    });
  }

  // Sort by frequency, take top 10
  enriched.sort((a, b) => b.frequency - a.frequency);
  return enriched.slice(0, 10);
}
```

### Metrics Output

| Metric | Calculation | Unit |
|--------|-------------|------|
| Top 10 Recipes | Frequency rank | count |
| Frequency | COUNT prep tasks per item (4w) | # |
| Avg Qty Per Prep | Total Qty / Frequency | ml, g, each |
| Consistency | Std Dev of quantities | Low = stable demand |
| Trend | (Week 4 vs Week 1) / Week 1 | % change |

### Key Assumptions

- Prep Task = one preparation action (may be batched)
- Item Name = recipe name (Sakura) or lookup via Item Name link (Waratah)
- Quantity is in the item's standard unit
- 4-week period captures typical demand

### Validation Checks

- [ ] Frequency > 0 (must have data)
- [ ] Quantity > 0 per task
- [ ] Item matches Items table
- [ ] Date is valid (ISO format)

---

## Metric 4: Staff Workload

### Business Question
How is ordering work distributed among staff? Is it balanced?

### Data Sources

| Table | Field | Purpose |
|-------|-------|---------|
| Ingredient Requirements | Item, Quantity Ordered | What to order |
| Items | Item, Supplier | Which supplier provides it |
| Supplier | Supplier Name, Ordering Staff | Who orders from this supplier |

### Query Flow

```
1. Fetch all Ingredient Requirements (current week)
   SELECT Item, Quantity Ordered FROM Ingredient Requirements

2. For each ingredient requirement:
   a. Look up Item → get Supplier link
   b. Look up Supplier → get Ordering Staff
   c. Sum Quantity Ordered by Staff name

3. Calculate per-staff metrics:
   - # of suppliers assigned
   - # of line items
   - Total quantity
   - % of overall load

4. Calculate load balance:
   Balance % = |Staff A - Staff B| / (A + B) × 100
```

### Calculation Logic

```javascript
function calculateStaffWorkload_(venue, data) {
  const staffWorkload = {};

  // For each ingredient requirement
  for (const ir of ingredientReqs) {
    const itemName = ir['Item'];
    const item = items.find(i => i['Item Name'] === itemName);

    if (!item) continue;

    // Get supplier name (may be linked record or text)
    const supplierRef = item['Supplier'];
    const supplierName = Array.isArray(supplierRef) ? supplierRef[0] : supplierRef;

    if (!supplierName) continue;

    // Get ordering staff from supplier
    const supplier = suppliers.find(s => s['Supplier Name'] === supplierName);
    if (!supplier) continue;

    const staffName = supplier['Ordering Staff'];

    // Accumulate workload for this staff
    if (!staffWorkload[staffName]) {
      staffWorkload[staffName] = {
        itemCount: 0,
        totalQty: 0,
        suppliers: new Set()
      };
    }

    staffWorkload[staffName].itemCount++;
    staffWorkload[staffName].totalQty += ir['Quantity Ordered'];
    staffWorkload[staffName].suppliers.add(supplierName);
  }

  // Convert to results array
  const results = [];
  let totalQty = 0;

  for (const [staff, data] of Object.entries(staffWorkload)) {
    totalQty += data.totalQty;
    results.push({
      staff,
      supplierCount: data.suppliers.size,
      itemCount: data.itemCount,
      totalQty: data.totalQty
    });
  }

  // Calculate percentages
  results.forEach(r => {
    r.percentOfLoad = totalQty > 0 ? (r.totalQty / totalQty * 100) : 0;
  });

  // Calculate balance
  let balance = 0;
  if (results.length === 2) {
    const [a, b] = results;
    balance = Math.abs(a.totalQty - b.totalQty) / totalQty * 100;
  }

  return { results, balance };
}
```

### Metrics Output (Sakura)

| Metric | Gooch | Sabs | Target |
|--------|-------|------|--------|
| % of Load | 48% | 52% | ±10% balance |
| Supplier Count | 12 | 8 | Distributed |
| Item Count | 45 | 38 | Similar |
| Total Qty (ml) | 2,100 | 2,200 | Balanced |

### Metrics Output (Waratah)

| Metric | Evan | Target |
|--------|------|--------|
| % of Load | 100% | N/A |
| Supplier Count | 18 | All |
| Item Count | 58 | All |
| Total Qty (ml) | 4,300 | N/A |

### Key Assumptions

- Sakura: 2 ordering staff (Gooch, Sabs)
- Waratah: 1 operator (Evan)
- Each supplier is assigned to exactly one staff member
- All Ingredient Requirements are from current prep run

### Validation Checks

- [ ] Supplier assignment is complete (no null values)
- [ ] Staff name matches configured aliases
- [ ] Item → Supplier links are valid
- [ ] Quantity > 0

---

## Metric 5: Feedback Trends

### Business Question
How much feedback are we getting? What's resolved? Which items have issues?

### Data Sources

| Table | Field | Purpose |
|-------|-------|---------|
| Feedback | Item, Type, Status, Date Created, Date Resolved, Triage Result | All staff feedback |
| Items | Item Name | Metadata |

### Query Flow

```
1. Fetch Feedback records (last 4 weeks)
   SELECT * FROM Feedback WHERE Date Created >= NOW() - 28 days

2. Count volume metrics:
   - Total count = # records
   - Resolved = count where Status = "Resolved"
   - Open = count where Status = "Open"

3. Calculate resolution:
   - Resolution Rate = Resolved / Total × 100%
   - Avg Days to Resolve = AVERAGE(Date Resolved - Date Created)

4. Group by Item:
   - For each item, count feedback records
   - Sort by count, take top 10

5. Group by Type (if exists):
   - e.g., "Recipe Issue", "Quantity Wrong", "Quality"
   - Count per type
```

### Calculation Logic

```javascript
function calculateFeedbackTrends_(venue, data) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Filter recent feedback
  const recent = feedback.filter(f =>
    new Date(f['Date Created']) >= fourWeeksAgo
  );

  // Volume metrics
  const byType = {};
  let resolved = 0, open = 0;
  const resolveTimes = [];

  for (const record of recent) {
    // Count by type
    const type = record['Type'] || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;

    // Count status
    if (record['Status'] === 'Resolved') {
      resolved++;

      // Calculate resolve time
      const created = new Date(record['Date Created']);
      const resolvedDate = new Date(record['Date Resolved']);
      const days = (resolvedDate - created) / (1000 * 60 * 60 * 24);
      resolveTimes.push(days);
    } else if (record['Status'] === 'Open') {
      open++;
    }
  }

  // Calculate rates
  const resolutionRate = recent.length > 0
    ? (resolved / recent.length * 100)
    : 0;

  const avgResolveTime = resolveTimes.length > 0
    ? resolveTimes.reduce((a,b) => a+b) / resolveTimes.length
    : null;

  // Top items
  const byItem = {};
  for (const record of recent) {
    const item = record['Item'] || 'Unknown';
    byItem[item] = (byItem[item] || 0) + 1;
  }

  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([item, count]) => ({ item, count }));

  return {
    totalFeedback: recent.length,
    resolved,
    open,
    resolutionRate,
    avgResolveTime,
    byType,
    topItems
  };
}
```

### Metrics Output

| Metric | Calculation | Target |
|--------|-------------|--------|
| Total Feedback (4w) | COUNT all | Trending up = engagement |
| Resolution Rate | Resolved / Total × 100% | > 90% |
| Avg Days to Resolve | AVERAGE resolve times | < 3 days |
| Open Issues | COUNT where Status = Open | < 5 |
| Top Items | Ranked by feedback count | Monitor |

### Key Assumptions

- Feedback records have Date Created (when logged)
- Resolved records have Date Resolved (when closed)
- Item field links to Items table
- Status values: "Open", "Resolved", "On Hold"

### Validation Checks

- [ ] Date Created is valid
- [ ] Date Resolved >= Date Created (for resolved items)
- [ ] Status is one of: Open, Resolved, On Hold
- [ ] Item name matches Items table

---

## Metric 6: Automation Health

### Business Question
Are automations working reliably? Error rates? Slow scripts?

### Data Sources

| Table | Field | Purpose |
|-------|-------|---------|
| Audit Log | Script Name, Status, Execution Time (ms), Timestamp, Error Message | All script runs |

### Query Flow

```
1. Fetch Audit Log (last 7 days)
   SELECT * FROM Audit Log WHERE Timestamp >= NOW() - 7 days
   SORT BY Timestamp DESC

2. Group by Script Name:
   For each script:
   a. Total runs = count records
   b. Success count = count where Status = "Success"
   c. Error count = count where Status = "Error"
   d. Success rate = Success count / Total × 100%

3. Calculate performance:
   a. Execution times (for successful runs only)
   b. Average = AVERAGE(times)
   c. P95 = 95th percentile
   d. Max = MAX(times)

4. Collect error details:
   - Error message (most common)
   - Timestamp of last error
```

### Calculation Logic

```javascript
function calculateAutomationHealth_(venue, data) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Filter recent logs
  const recent = auditLog.filter(log =>
    new Date(log['Timestamp']) >= sevenDaysAgo
  );

  // Group by script
  const byScript = {};

  for (const log of recent) {
    const scriptName = log['Script Name'] || 'Unknown';

    if (!byScript[scriptName]) {
      byScript[scriptName] = {
        total: 0,
        success: 0,
        error: 0,
        executionTimes: [],
        errors: []
      };
    }

    byScript[scriptName].total++;

    if (log['Status'] === 'Success') {
      byScript[scriptName].success++;
      const execTime = parseFloat(log['Execution Time (ms)']);
      if (!isNaN(execTime)) {
        byScript[scriptName].executionTimes.push(execTime);
      }
    } else if (log['Status'] === 'Error') {
      byScript[scriptName].error++;
      byScript[scriptName].errors.push({
        timestamp: log['Timestamp'],
        message: log['Error Message']
      });
    }
  }

  // Calculate metrics per script
  const results = [];
  let totalRuns = 0, totalSuccesses = 0;

  for (const [script, data] of Object.entries(byScript)) {
    totalRuns += data.total;
    totalSuccesses += data.success;

    const successRate = data.total > 0
      ? (data.success / data.total * 100)
      : 0;

    // Calculate execution time stats
    let avgTime = 0, p95Time = 0, maxTime = 0;
    if (data.executionTimes.length > 0) {
      avgTime = data.executionTimes.reduce((a,b) => a+b) / data.executionTimes.length;
      maxTime = Math.max(...data.executionTimes);

      const sorted = data.executionTimes.sort((a,b) => a-b);
      const idx = Math.ceil(sorted.length * 0.95) - 1;
      p95Time = sorted[idx];
    }

    results.push({
      script,
      totalRuns: data.total,
      successRate,
      errorCount: data.error,
      avgTime: avgTime.toFixed(0),
      p95Time: p95Time.toFixed(0),
      maxTime: maxTime.toFixed(0),
      recentErrors: data.errors.slice(-3)
    });
  }

  // Overall health
  const overallSuccessRate = totalRuns > 0
    ? (totalSuccesses / totalRuns * 100)
    : 0;

  const healthStatus = overallSuccessRate >= 95 ? 'GREEN'
    : overallSuccessRate >= 90 ? 'YELLOW'
    : 'RED';

  return {
    overallSuccessRate,
    healthStatus,
    scripts: results
  };
}
```

### Metrics Output

| Metric | Calculation | Target | Alert |
|--------|-------------|--------|-------|
| Overall Success Rate | Total successes / total runs × 100% | 99%+ | < 95% |
| Failed Script Count | COUNT where success rate < 95% | 0 | > 0 |
| Avg Execution Time | AVERAGE of successful run times | < 60s | > 120s |
| P95 Execution Time | 95th percentile | < 180s | > 300s |
| Error Count (7d) | COUNT where Status = Error | 0–1 | > 3 |

### Key Assumptions

- Audit Log records every script run
- Status values: "Success", "Error", "Timeout"
- Execution Time in milliseconds
- One entry per script run (not per operation within script)

### Validation Checks

- [ ] Timestamp is valid (ISO format)
- [ ] Script Name is not null
- [ ] Status is valid
- [ ] Execution Time > 0 (can't be negative)

---

## Metric 7: Cross-Venue Comparison

### Business Question
How do Sakura House and The Waratah compare on key metrics?

### Data Flow

```
1. Run all calculations for Sakura (metrics 1–6)
2. Run all calculations for Waratah (metrics 1–6)
3. Side-by-side comparison:
   - Extract same metric from both venues
   - Calculate difference
   - Highlight if > 15% variance
4. Generate visual comparisons:
   - Radar chart (6 dimensions)
   - Trend lines (same scale)
   - Heatmap of differences
```

### Comparison Matrix

```
METRIC                      SAKURA    WARATAH   DIFF    STATUS
─────────────────────────────────────────────────────────────
Prep Efficiency (4w avg)    98.5%     95.2%     +3.3%   ✓ Sakura leads
Over-Production Count       1 item    3 items   +2      ⚠ Waratah higher
Under-Production Count      0 items   1 item    +1      ⚠ Waratah higher
Top Recipe (4w)             [A] 12x   [B] 18x   diff    ✗ Different items
Staff Workload Balance      52%/48%   100% Evan diff    ✗ Structural diff
Feedback Resolution         92%       88%       +4%     ✓ Sakura faster
Automation Success Rate     99%       96%       +3%     ✓ Sakura reliable
```

### Calculation Logic

```javascript
function calculateCrossVenueComparison_(sakuraData, waratahData) {
  // Calculate all metrics for both venues
  const sakura = {
    prepEff: calculatePrepEfficiency_('sakura', sakuraData),
    waste: calculateWasteIndicators_('sakura', sakuraData),
    popularity: calculateRecipePopularity_('sakura', sakuraData),
    workload: calculateStaffWorkload_('sakura', sakuraData),
    feedback: calculateFeedbackTrends_('sakura', sakuraData),
    health: calculateAutomationHealth_('sakura', sakuraData)
  };

  const waratah = {
    prepEff: calculatePrepEfficiency_('waratah', waratahData),
    waste: calculateWasteIndicators_('waratah', waratahData),
    popularity: calculateRecipePopularity_('waratah', waratahData),
    workload: calculateStaffWorkload_('waratah', waratahData),
    feedback: calculateFeedbackTrends_('waratah', waratahData),
    health: calculateAutomationHealth_('waratah', waratahData)
  };

  // Extract comparable metrics
  const comparison = {
    prepEfficiency: {
      sakura: calculateAverage(sakura.prepEff.map(r => parseFloat(r.efficiency))),
      waratah: calculateAverage(waratah.prepEff.map(r => parseFloat(r.efficiency)))
    },
    overProductionCount: {
      sakura: sakura.prepEff.reduce((sum, r) => sum + r.overCount, 0),
      waratah: waratah.prepEff.reduce((sum, r) => sum + r.overCount, 0)
    },
    // ... other metrics
  };

  // Calculate differences
  for (const [metric, values] of Object.entries(comparison)) {
    const diff = Math.abs(values.sakura - values.waratah);
    const percentDiff = (diff / values.sakura * 100);

    comparison[metric].difference = diff;
    comparison[metric].percentDiff = percentDiff;
    comparison[metric].flagged = percentDiff > 15;  // Flag if > 15% variance
  }

  return comparison;
}
```

---

## Summary: Query Complexity vs Performance

| Metric | # API Calls | Data Points | Compute Time | Cache TTL |
|--------|-------------|-------------|--------------|-----------|
| Prep Efficiency | 3 calls | 100–200 | < 5s | 2h |
| Waste Indicators | 2 calls | 1000–2000 | < 10s | 2h |
| Recipe Popularity | 1 call | 500–1000 | < 3s | 2h |
| Staff Workload | 3 calls | 50–100 | < 2s | 2h |
| Feedback Trends | 1 call | 100–200 | < 2s | 2h |
| Automation Health | 1 call | 100–300 | < 2s | 2h |
| Cross-Venue Comp | 12 calls | 2000–4000 | < 20s | 2h |

**Total per full refresh:** ~15 API calls, ~90 seconds execution time

---

**Document Status:** Complete | Ready for implementation
