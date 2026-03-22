/**
 * PREP Systems Analytics Dashboard — GAS Implementation Template
 *
 * Phase 2.4 Complete Code Scaffold
 * Status: Ready for implementation
 * Created: 2026-03-23
 *
 * Usage:
 * 1. Copy this file to Google Apps Script project as AnalyticsDashboard.gs
 * 2. Update CFG object with base IDs, table IDs, sheet ID
 * 3. Set Script Properties: AIRTABLE_PAT, DASHBOARD_SHEET_ID
 * 4. Implement each section (marked with TODO)
 * 5. Deploy; test with manualRefresh()
 * 6. Create time-driven triggers in Apps Script editor
 */

// ============================================================================
// CONFIG & CONSTANTS
// ============================================================================

const DASHBOARD_SHEET_ID = PropertiesService.getScriptProperties().getProperty('DASHBOARD_SHEET_ID');
const AIRTABLE_PAT = PropertiesService.getScriptProperties().getProperty('AIRTABLE_PAT');

const CFG = {
  venues: {
    sakura: {
      baseId: 'appNsFRhuU47e9qlR',
      tables: {
        items: 'tblMiIJW5c1yaKATc',
        supplier: 'tblSOucoAqhDTI2j4',
        recipes: 'tblIuwtYka7LIaegW',
        recipeLines: 'tblSkdQxcPMfkkFXw',
        parLevels: 'tblTTBmL9vNqCKKAK',
        weeklyCounts: 'tblWWQ8wDKj8g9RYL',
        prepRuns: 'tblPrepRuns123456',
        prepTasks: 'tblPrepTasks123456',
        ingredientReqs: 'tblIngredientReqs123',
        auditLog: 'tblAuditLog123456',
        feedback: 'tblFeedback123456'
      },
      staffAliases: {
        'Gooch': 'Gooch',
        'Sabs': 'Sabs',
        'Sabine': 'Sabs'
      }
    },
    waratah: {
      baseId: 'appfcy14ZikhKZnRS',
      tables: {
        items: 'tblItems_Waratah',
        supplier: 'tblSupplier_Waratah',
        recipes: 'tblRecipes_Waratah',
        recipeLines: 'tblRecipeLines_Waratah',
        parLevels: 'tblParLevels_Waratah',
        weeklyCounts: 'tblWeeklyCounts_Waratah',
        stockCounts: 'tblStockCounts_Waratah',
        countSessions: 'tblCountSessions_Waratah',
        prepRuns: 'tblPrepRuns_Waratah',
        prepTasks: 'tblPrepTasks_Waratah',
        ingredientReqs: 'tblIngredientReqs_Waratah',
        auditLog: 'tblAuditLog_Waratah',
        feedback: 'tblFeedback_Waratah'
      },
      staffAliases: {
        'Evan': 'Evan',
        'Andie': 'Evan',
        'Blade': 'Evan'
      }
    }
  },
  cache: {
    ttlSeconds: 7200  // 2 hours
  },
  sheet: {
    tabs: [
      'DASHBOARD',
      'Prep Efficiency',
      'Waste Analysis',
      'Recipe Popularity',
      'Staff Workload',
      'Feedback Trends',
      'Automation Health',
      'Cross-Venue Comparison',
      'Data Cache'
    ]
  }
};

// ============================================================================
// PHASE 1: DATA FETCHING & CACHING
// ============================================================================

/**
 * Fetch a single Airtable table with pagination
 * @param {string} venue - 'sakura' or 'waratah'
 * @param {string} tableName - e.g., 'items', 'prepRuns'
 * @param {Object} options - { filterByFormula, sortField, ascending }
 * @returns {Array} Array of record objects with { id, ...fields }
 */
function fetchAirtableTable_(venue, tableName, options = {}) {
  const venueConfig = CFG.venues[venue];
  const baseId = venueConfig.baseId;
  const tableId = venueConfig.tables[tableName];

  if (!tableId) {
    Logger.log(`ERROR: Table ${tableName} not configured for ${venue}`);
    return [];
  }

  const allRecords = [];
  let offset = null;
  let requestCount = 0;

  do {
    try {
      // Build URL with pagination
      let url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100`;

      if (options.filterByFormula) {
        url += `&filterByFormula=${encodeURIComponent(options.filterByFormula)}`;
      }

      if (options.sortField) {
        url += `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(options.sortField)}`;
        url += `&sort%5B0%5D%5Bdirection%5D=${options.ascending ? 'asc' : 'desc'}`;
      }

      if (offset) {
        url += `&offset=${offset}`;
      }

      // Make request
      const options_ = {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options_);
      const statusCode = response.getResponseCode();
      const headers = response.getHeaders();

      // Check rate limit
      const rateLimitRemaining = parseInt(headers['x-ratelimit-remaining'] || 300);
      if (rateLimitRemaining < 10) {
        Logger.log(`WARN: Rate limit low (${rateLimitRemaining} remaining)`);
      }

      if (statusCode !== 200) {
        Logger.log(`ERROR: Airtable API returned ${statusCode}`);
        Logger.log(`Response: ${response.getContentText()}`);
        break;
      }

      // Parse response
      const data = JSON.parse(response.getContentText());
      const records = data.records || [];

      // Transform to flat objects
      records.forEach(r => {
        allRecords.push({
          id: r.id,
          ...r.fields
        });
      });

      offset = data.offset;
      requestCount++;

      // Small delay to avoid rate limiting
      if (offset) {
        Utilities.sleep(200);
      }

    } catch (err) {
      Logger.log(`ERROR in fetchAirtableTable_: ${err}`);
      break;
    }

  } while (offset);

  Logger.log(`Fetched ${allRecords.length} records from ${venue}.${tableName} (${requestCount} requests)`);
  return allRecords;
}

/**
 * Get data from cache or fetch fresh
 * @param {string} cacheKey - e.g., 'prep_runs_sakura'
 * @param {Function} fetchFn - function to call if cache miss
 * @returns {Array} Records
 */
function getOrFetch_(cacheKey, fetchFn) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);

  if (cached) {
    Logger.log(`Cache hit: ${cacheKey}`);
    return JSON.parse(cached);
  }

  Logger.log(`Cache miss: ${cacheKey}, fetching fresh...`);
  const data = fetchFn();

  // Save to cache
  try {
    cache.put(cacheKey, JSON.stringify(data), CFG.cache.ttlSeconds);
  } catch (err) {
    Logger.log(`WARN: Could not cache ${cacheKey} (size limit): ${err}`);
  }

  return data;
}

/**
 * Fetch all required data for a venue
 */
function fetchAllData_(venue) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().split('T')[0];

  const data = {
    items: getOrFetch_(
      `items_${venue}`,
      () => fetchAirtableTable_(venue, 'items', { sortField: 'Item Name', ascending: true })
    ),
    suppliers: getOrFetch_(
      `suppliers_${venue}`,
      () => fetchAirtableTable_(venue, 'supplier', { sortField: 'Supplier Name', ascending: true })
    ),
    recipes: getOrFetch_(
      `recipes_${venue}`,
      () => fetchAirtableTable_(venue, 'recipes', { sortField: 'Recipe ID', ascending: true })
    ),
    prepRuns: getOrFetch_(
      `prep_runs_${venue}`,
      () => fetchAirtableTable_(venue, 'prepRuns', { sortField: 'Date', ascending: false })
    ),
    prepTasks: getOrFetch_(
      `prep_tasks_${venue}`,
      () => fetchAirtableTable_(venue, 'prepTasks', { sortField: 'Date', ascending: false })
    ),
    ingredientReqs: getOrFetch_(
      `ingredient_reqs_${venue}`,
      () => fetchAirtableTable_(venue, 'ingredientReqs', { sortField: 'Date', ascending: false })
    ),
    weeklyCounts: getOrFetch_(
      `weekly_counts_${venue}`,
      () => fetchAirtableTable_(venue, 'weeklyCounts', { sortField: 'Date', ascending: false })
    ),
    auditLog: getOrFetch_(
      `audit_log_${venue}`,
      () => fetchAirtableTable_(venue, 'auditLog', {
        filterByFormula: `IS_AFTER({Timestamp}, "${sevenDaysAgoIso}")`,
        sortField: 'Timestamp',
        ascending: false
      })
    ),
    feedback: getOrFetch_(
      `feedback_${venue}`,
      () => fetchAirtableTable_(venue, 'feedback', { sortField: 'Date', ascending: false })
    )
  };

  return data;
}

// ============================================================================
// PHASE 2: CALCULATION ENGINE
// ============================================================================

/**
 * Metric 2.1: Prep Efficiency
 */
function calculatePrepEfficiency_(venue, data) {
  const results = [];
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentPrepRuns = data.prepRuns.filter(pr => {
    const runDate = new Date(pr['Date']);
    return runDate >= fourWeeksAgo;
  });

  for (const run of recentPrepRuns) {
    const runId = run.id;
    const runDate = run['Date'];

    // Get ordered items
    const orderedItems = data.ingredientReqs.filter(ir => ir['Prep Run'] && (ir['Prep Run'][0] === runId || ir['Prep Run'] === runId));
    // Get prepared items
    const preparedItems = data.prepTasks.filter(pt => pt['Prep Run'] && (pt['Prep Run'][0] === runId || pt['Prep Run'] === runId));

    // Group by item name
    const itemMap = {};

    orderedItems.forEach(ir => {
      const itemName = ir['Item'];
      if (!itemMap[itemName]) itemMap[itemName] = { ordered: 0, prepared: 0 };
      itemMap[itemName].ordered += parseFloat(ir['Quantity Ordered']) || 0;
    });

    preparedItems.forEach(pt => {
      const itemName = pt['Item'];
      if (!itemMap[itemName]) itemMap[itemName] = { ordered: 0, prepared: 0 };
      itemMap[itemName].prepared += parseFloat(pt['Quantity']) || 0;
    });

    // Calculate metrics
    let totalOrdered = 0, totalPrepared = 0, overCount = 0, underCount = 0;
    const variances = [];

    for (const [item, qty] of Object.entries(itemMap)) {
      totalOrdered += qty.ordered;
      totalPrepared += qty.prepared;

      const variance = qty.ordered > 0 ? ((qty.prepared - qty.ordered) / qty.ordered) * 100 : 0;
      variances.push(variance);

      if (qty.prepared > qty.ordered * 1.10) overCount++;
      if (qty.prepared < qty.ordered * 0.90) underCount++;
    }

    const efficiency = totalOrdered > 0 ? (totalPrepared / totalOrdered) * 100 : 0;
    const avgVariance = variances.length > 0 ? (variances.reduce((a, b) => a + b) / variances.length) : 0;

    results.push({
      date: runDate,
      runId,
      efficiency: efficiency.toFixed(1),
      avgVariance: avgVariance.toFixed(1),
      overCount,
      underCount,
      itemCount: Object.keys(itemMap).length
    });
  }

  return results.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Metric 2.2: Waste Indicators
 */
function calculateWasteIndicators_(venue, data) {
  const results = [];
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  for (const item of data.items) {
    const itemName = item['Item Name'];
    const parLevel = parseFloat(item['Par Level']) || 0;

    const recentCounts = data.weeklyCounts.filter(wc =>
      wc['Item'] === itemName &&
      wc['Confirmed'] === true &&
      new Date(wc['Date']) >= fourWeeksAgo
    );

    if (recentCounts.length === 0) continue;

    let overWeeks = 0, underWeeks = 0;
    const stockLevels = [];

    recentCounts.forEach(count => {
      const countQty = parseFloat(count['Quantity']) || 0;
      const percentOfPar = parLevel > 0 ? (countQty / parLevel) * 100 : 0;

      stockLevels.push(percentOfPar);

      if (percentOfPar > 120) overWeeks++;
      if (percentOfPar < 95) underWeeks++;
    });

    const avgPercentOfPar = stockLevels.length > 0
      ? (stockLevels.reduce((a, b) => a + b) / stockLevels.length)
      : 0;

    let riskFlag = 'OK';
    if (overWeeks >= 3) riskFlag = 'OVER-STOCK';
    else if (underWeeks >= 3) riskFlag = 'UNDER-STOCK';

    results.push({
      itemName,
      parLevel,
      overWeeks,
      underWeeks,
      avgPercentOfPar: avgPercentOfPar.toFixed(1),
      riskFlag
    });
  }

  return results.sort((a, b) => {
    // Sort by risk flag first (red > orange > green)
    const riskOrder = { 'OVER-STOCK': 0, 'UNDER-STOCK': 1, 'OK': 2 };
    return riskOrder[a.riskFlag] - riskOrder[b.riskFlag];
  });
}

/**
 * Metric 2.3: Recipe Popularity (Top 10)
 */
function calculateRecipePopularity_(venue, data) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const itemFrequency = {};

  data.prepTasks.forEach(pt => {
    const taskDate = new Date(pt['Date']);
    if (taskDate >= fourWeeksAgo) {
      const itemName = pt['Item'];

      if (!itemFrequency[itemName]) {
        itemFrequency[itemName] = { frequency: 0, totalQty: 0 };
      }

      itemFrequency[itemName].frequency++;
      itemFrequency[itemName].totalQty += parseFloat(pt['Quantity']) || 0;
    }
  });

  // Enrich with item metadata
  const enriched = [];
  for (const [itemName, data_] of Object.entries(itemFrequency)) {
    const item = data.items.find(i => i['Item Name'] === itemName);
    const recipe = data.recipes.find(r => r['Item Name'] === itemName || (r['Item Name'] && r['Item Name'][0] === itemName));

    enriched.push({
      itemName,
      frequency: data_.frequency,
      totalQty: data_.totalQty.toFixed(1),
      avgQty: (data_.totalQty / data_.frequency).toFixed(1),
      itemType: item ? item['Item Type'] : 'Unknown'
    });
  }

  // Sort and take top 10
  enriched.sort((a, b) => b.frequency - a.frequency);
  return enriched.slice(0, 10);
}

/**
 * Metric 2.4: Staff Workload
 */
function calculateStaffWorkload_(venue, data) {
  const staffWorkload = {};

  data.ingredientReqs.forEach(ir => {
    const itemName = ir['Item'];
    const item = data.items.find(i => i['Item Name'] === itemName);

    if (!item) return;

    const supplierNames = item['Supplier'] || [];
    const supplierName = Array.isArray(supplierNames) ? supplierNames[0] : supplierNames;

    if (!supplierName) return;

    const supplier = data.suppliers.find(s => s['Supplier Name'] === supplierName);
    if (!supplier) return;

    const staffName = supplier['Ordering Staff'] || (venue === 'waratah' ? 'Evan' : 'Unknown');

    if (!staffWorkload[staffName]) {
      staffWorkload[staffName] = { itemCount: 0, totalQty: 0, suppliers: new Set() };
    }

    staffWorkload[staffName].itemCount++;
    staffWorkload[staffName].totalQty += parseFloat(ir['Quantity Ordered']) || 0;
    staffWorkload[staffName].suppliers.add(supplierName);
  });

  // Calculate percentages
  const results = [];
  let totalQty = 0;

  for (const [staff, data_] of Object.entries(staffWorkload)) {
    totalQty += data_.totalQty;
    results.push({
      staff,
      supplierCount: data_.suppliers.size,
      itemCount: data_.itemCount,
      totalQty: data_.totalQty
    });
  }

  results.forEach(r => {
    r.percentOfLoad = totalQty > 0 ? ((r.totalQty / totalQty) * 100).toFixed(1) : '0';
  });

  return results;
}

/**
 * Metric 2.5: Feedback Trends
 */
function calculateFeedbackTrends_(venue, data) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentFeedback = data.feedback.filter(f =>
    new Date(f['Date']) >= fourWeeksAgo
  );

  // Volume by type
  const byType = {};
  let resolved = 0, open = 0;
  const resolveTimes = [];

  recentFeedback.forEach(f => {
    const type = f['Type'] || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;

    if (f['Status'] === 'Resolved') resolved++;
    else if (f['Status'] === 'Open') open++;

    // Calculate resolve time
    if (f['Status'] === 'Resolved' && f['Date Created'] && f['Date Resolved']) {
      const days = (new Date(f['Date Resolved']) - new Date(f['Date Created'])) / (1000 * 60 * 60 * 24);
      resolveTimes.push(days);
    }
  });

  const resolutionRate = recentFeedback.length > 0 ? (resolved / recentFeedback.length * 100).toFixed(1) : '0';
  const avgResolveTime = resolveTimes.length > 0 ? (resolveTimes.reduce((a, b) => a + b) / resolveTimes.length).toFixed(1) : 'N/A';

  // Top items
  const byItem = {};
  recentFeedback.forEach(f => {
    const item = f['Item'] || 'Unknown';
    byItem[item] = (byItem[item] || 0) + 1;
  });

  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([item, count]) => ({ item, count }));

  return {
    totalFeedback: recentFeedback.length,
    resolved,
    open,
    resolutionRate,
    avgResolveTime,
    byType,
    topItems
  };
}

/**
 * Metric 2.6: Automation Health
 */
function calculateAutomationHealth_(venue, data) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLogs = data.auditLog.filter(log =>
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
        recentErrors: []
      };
    }

    byScript[script].total++;

    if (log['Status'] === 'Success') {
      byScript[script].success++;
      const execTime = parseFloat(log['Execution Time (ms)']) || 0;
      byScript[script].executionTimes.push(execTime);
    } else {
      byScript[script].error++;
      byScript[script].recentErrors.push({
        timestamp: log['Timestamp'],
        message: log['Error Message']
      });
    }
  });

  // Calculate metrics
  const results = [];
  let totalRuns = 0, totalSuccesses = 0;

  for (const [script, data_] of Object.entries(byScript)) {
    totalRuns += data_.total;
    totalSuccesses += data_.success;

    const successRate = data_.total > 0 ? (data_.success / data_.total * 100).toFixed(1) : '0';
    const avgTime = data_.executionTimes.length > 0
      ? (data_.executionTimes.reduce((a, b) => a + b) / data_.executionTimes.length).toFixed(0)
      : '0';

    results.push({
      script,
      totalRuns: data_.total,
      successRate,
      errorCount: data_.error,
      avgTime,
      recentErrors: data_.recentErrors.slice(-3)
    });
  }

  const overallSuccessRate = totalRuns > 0 ? (totalSuccesses / totalRuns * 100).toFixed(1) : '0';

  return {
    overallSuccessRate,
    scripts: results,
    healthStatus: overallSuccessRate >= 95 ? 'GREEN' : (overallSuccessRate >= 90 ? 'YELLOW' : 'RED')
  };
}

// ============================================================================
// PHASE 3: SHEET POPULATION
// ============================================================================

/**
 * Write Prep Efficiency data to sheet
 */
function writePrepEfficiencyTab_(sheet, data) {
  const tab = sheet.getSheetByName('Prep Efficiency') || sheet.insertSheet('Prep Efficiency');
  tab.clearContents();

  const headers = ['Date', 'Prep Run ID', 'Efficiency %', 'Avg Variance %', 'Over-Count', 'Under-Count'];
  tab.getRange(1, 1, 1, headers.length).setValues([headers]);
  tab.getRange(1, 1, 1, headers.length).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const rows = data.map(d => [d.date, d.runId, d.efficiency, d.avgVariance, d.overCount, d.underCount]);
  if (rows.length > 0) {
    tab.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Conditional formatting
  const efficiencyRange = tab.getRange(2, 3, rows.length, 1);
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(95, 105)
    .setBackground('#A4C2F4')
    .setRanges([efficiencyRange])
    .build();
  tab.addConditionalFormatRule(rule);

  // Timestamp
  tab.getRange(rows.length + 3, 1).setValue(`Last Updated: ${new Date().toLocaleString()}`).setFontStyle('italic');
}

/**
 * Write Waste Analysis to sheet
 */
function writeWasteAnalysisTab_(sheet, data) {
  const tab = sheet.getSheetByName('Waste Analysis') || sheet.insertSheet('Waste Analysis');
  tab.clearContents();

  const headers = ['Item Name', 'Par Level', 'Over-Weeks (4w)', 'Under-Weeks (4w)', 'Avg % of Par', 'Risk Flag'];
  tab.getRange(1, 1, 1, headers.length).setValues([headers]);
  tab.getRange(1, 1, 1, headers.length).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const rows = data.map(d => [d.itemName, d.parLevel, d.overWeeks, d.underWeeks, d.avgPercentOfPar, d.riskFlag]);
  if (rows.length > 0) {
    tab.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Conditional formatting on risk flag
  const riskRange = tab.getRange(2, 6, rows.length, 1);
  const ruleOver = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('OVER-STOCK')
    .setBackground('#FFB3B3')
    .setRanges([riskRange])
    .build();
  const ruleUnder = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('UNDER-STOCK')
    .setBackground('#FFFFCC')
    .setRanges([riskRange])
    .build();
  tab.addConditionalFormatRule(ruleOver);
  tab.addConditionalFormatRule(ruleUnder);

  tab.getRange(rows.length + 3, 1).setValue(`Last Updated: ${new Date().toLocaleString()}`).setFontStyle('italic');
}

/**
 * Write Recipe Popularity to sheet
 */
function writeRecipePopularityTab_(sheet, data) {
  const tab = sheet.getSheetByName('Recipe Popularity') || sheet.insertSheet('Recipe Popularity');
  tab.clearContents();

  const headers = ['Rank', 'Recipe/Item Name', 'Frequency (4w)', 'Avg Qty Per Prep', 'Item Type'];
  tab.getRange(1, 1, 1, headers.length).setValues([headers]);
  tab.getRange(1, 1, 1, headers.length).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const rows = data.map((d, idx) => [idx + 1, d.itemName, d.frequency, d.avgQty, d.itemType]);
  if (rows.length > 0) {
    tab.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  tab.getRange(rows.length + 3, 1).setValue(`Last Updated: ${new Date().toLocaleString()}`).setFontStyle('italic');
}

/**
 * Write Staff Workload to sheet
 */
function writeStaffWorkloadTab_(sheet, data) {
  const tab = sheet.getSheetByName('Staff Workload') || sheet.insertSheet('Staff Workload');
  tab.clearContents();

  const headers = ['Staff Name', 'Supplier Count', 'Item Count', 'Total Qty', '% of Load'];
  tab.getRange(1, 1, 1, headers.length).setValues([headers]);
  tab.getRange(1, 1, 1, headers.length).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const rows = data.map(d => [d.staff, d.supplierCount, d.itemCount, d.totalQty.toFixed(1), `${d.percentOfLoad}%`]);
  if (rows.length > 0) {
    tab.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  tab.getRange(rows.length + 3, 1).setValue(`Last Updated: ${new Date().toLocaleString()}`).setFontStyle('italic');
}

/**
 * Write Feedback Trends to sheet
 */
function writeFeedbackTrendsTab_(sheet, data) {
  const tab = sheet.getSheetByName('Feedback Trends') || sheet.insertSheet('Feedback Trends');
  tab.clearContents();

  // Summary row
  const summaryHeaders = ['Metric', 'Value'];
  tab.getRange(1, 1, 1, 2).setValues([summaryHeaders]);
  tab.getRange(1, 1, 1, 2).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const summaryRows = [
    ['Total Feedback (4w)', data.totalFeedback],
    ['Resolved', `${data.resolved} (${data.resolutionRate}%)`],
    ['Open', data.open],
    ['Avg Days to Resolve', data.avgResolveTime]
  ];

  tab.getRange(2, 1, summaryRows.length, 2).setValues(summaryRows);

  // Top items
  const topItemsStart = summaryRows.length + 3;
  const topHeaders = ['Top Items by Feedback', 'Count'];
  tab.getRange(topItemsStart, 1, 1, 2).setValues([topHeaders]);
  tab.getRange(topItemsStart, 1, 1, 2).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const topRows = data.topItems.map(d => [d.item, d.count]);
  if (topRows.length > 0) {
    tab.getRange(topItemsStart + 1, 1, topRows.length, 2).setValues(topRows);
  }

  tab.getRange(topItemsStart + topRows.length + 2, 1).setValue(`Last Updated: ${new Date().toLocaleString()}`).setFontStyle('italic');
}

/**
 * Write Automation Health to sheet
 */
function writeAutomationHealthTab_(sheet, data) {
  const tab = sheet.getSheetByName('Automation Health') || sheet.insertSheet('Automation Health');
  tab.clearContents();

  // Summary
  const healthColor = data.healthStatus === 'GREEN' ? '#A4C2F4' : (data.healthStatus === 'YELLOW' ? '#FFFFCC' : '#FFB3B3');
  const summaryHeaders = ['Health Status', 'Overall Success Rate'];
  tab.getRange(1, 1, 1, 2).setValues([summaryHeaders]);
  tab.getRange(1, 1, 1, 2).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');
  tab.getRange(2, 1).setValue(data.healthStatus).setBackground(healthColor);
  tab.getRange(2, 2).setValue(`${data.overallSuccessRate}%`).setBackground(healthColor);

  // Script details
  const scriptStart = 4;
  const scriptHeaders = ['Script Name', 'Total Runs', 'Success Rate', 'Error Count', 'Avg Time (ms)'];
  tab.getRange(scriptStart, 1, 1, scriptHeaders.length).setValues([scriptHeaders]);
  tab.getRange(scriptStart, 1, 1, scriptHeaders.length).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

  const scriptRows = data.scripts.map(d => [d.script, d.totalRuns, `${d.successRate}%`, d.errorCount, d.avgTime]);
  if (scriptRows.length > 0) {
    tab.getRange(scriptStart + 1, 1, scriptRows.length, scriptHeaders.length).setValues(scriptRows);
  }

  tab.getRange(scriptStart + scriptRows.length + 2, 1).setValue(`Last Updated: ${new Date().toLocaleString()}`).setFontStyle('italic');
}

// ============================================================================
// PHASE 4: ORCHESTRATION
// ============================================================================

/**
 * Main daily refresh (called by time-driven trigger)
 */
function dailyRefresh() {
  try {
    Logger.log('=== DAILY REFRESH START ===');
    const startTime = Date.now();

    const sheet = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);

    // Fetch data for both venues
    const sakuraData = fetchAllData_('sakura');
    const waratahData = fetchAllData_('waratah');

    // Calculate metrics
    const sakuraPrepEff = calculatePrepEfficiency_('sakura', sakuraData);
    const sakuraWaste = calculateWasteIndicators_('sakura', sakuraData);
    const sakuraFeedback = calculateFeedbackTrends_('sakura', sakuraData);
    const sakuraHealth = calculateAutomationHealth_('sakura', sakuraData);

    const waratahPrepEff = calculatePrepEfficiency_('waratah', waratahData);
    const waratahWaste = calculateWasteIndicators_('waratah', waratahData);
    const waratahFeedback = calculateFeedbackTrends_('waratah', waratahData);
    const waratahHealth = calculateAutomationHealth_('waratah', waratahData);

    // Write to sheet
    writePrepEfficiencyTab_(sheet, sakuraPrepEff);
    writeWasteAnalysisTab_(sheet, sakuraWaste);
    writeFeedbackTrendsTab_(sheet, sakuraFeedback);
    writeAutomationHealthTab_(sheet, sakuraHealth);

    const duration = Date.now() - startTime;
    Logger.log(`=== DAILY REFRESH COMPLETE (${duration}ms) ===`);

    logAuditEntry('AnalyticsDashboard.gs', 'dailyRefresh', 'Success', duration);

  } catch (err) {
    Logger.log(`ERROR in dailyRefresh: ${err}`);
    logAuditEntry('AnalyticsDashboard.gs', 'dailyRefresh', 'Error', 0, err.toString());
  }
}

/**
 * Main weekly refresh (called by time-driven trigger)
 */
function weeklyRefresh() {
  try {
    Logger.log('=== WEEKLY REFRESH START ===');
    const startTime = Date.now();

    const sheet = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);

    // Fetch data
    const sakuraData = fetchAllData_('sakura');
    const waratahData = fetchAllData_('waratah');

    // Calculate weekly metrics
    const sakuraPopularity = calculateRecipePopularity_('sakura', sakuraData);
    const sakuraWorkload = calculateStaffWorkload_('sakura', sakuraData);

    const waratahPopularity = calculateRecipePopularity_('waratah', waratahData);
    const waratahWorkload = calculateStaffWorkload_('waratah', waratahData);

    // Write to sheet
    writeRecipePopularityTab_(sheet, sakuraPopularity);
    writeStaffWorkloadTab_(sheet, sakuraWorkload);

    const duration = Date.now() - startTime;
    Logger.log(`=== WEEKLY REFRESH COMPLETE (${duration}ms) ===`);

    logAuditEntry('AnalyticsDashboard.gs', 'weeklyRefresh', 'Success', duration);

  } catch (err) {
    Logger.log(`ERROR in weeklyRefresh: ${err}`);
    logAuditEntry('AnalyticsDashboard.gs', 'weeklyRefresh', 'Error', 0, err.toString());
  }
}

/**
 * Manual refresh (user-triggered)
 */
function manualRefresh() {
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput('<p>Refreshing analytics...</p>'),
      'Analytics Dashboard'
    );

    dailyRefresh();
    weeklyRefresh();

    SpreadsheetApp.getUi().alert('Dashboard refreshed successfully!');
  } catch (err) {
    SpreadsheetApp.getUi().alert(`Error refreshing: ${err}`);
  }
}

/**
 * Create custom menu in sheet
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Analytics')
    .addItem('Refresh All Data', 'manualRefresh')
    .addItem('Clear Cache', 'clearCache')
    .addToUi();
}

/**
 * Clear all caches
 */
function clearCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(['prep_runs_sakura', 'prep_runs_waratah', 'items_sakura', 'items_waratah']);
  SpreadsheetApp.getUi().alert('Cache cleared!');
}

// ============================================================================
// HELPER: Audit Logging
// ============================================================================

function logAuditEntry(scriptName, functionName, status, executionTimeMs, errorMessage = null) {
  try {
    const auditSheet = SpreadsheetApp.openById(DASHBOARD_SHEET_ID).getSheetByName('Data Cache');
    if (auditSheet) {
      auditSheet.appendRow([
        new Date().toISOString(),
        scriptName,
        functionName,
        status,
        executionTimeMs,
        errorMessage || ''
      ]);
    }
  } catch (err) {
    Logger.log(`Could not log audit entry: ${err}`);
  }
}

// ============================================================================
// END
// ============================================================================
