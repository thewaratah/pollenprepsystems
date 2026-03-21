/**
 * Waratah_GenerateStockOrders.gs
 *
 * Airtable Automation Script — runs INSIDE Airtable (not GAS).
 * Aggregates stock counts by item, looks up par levels and prep usage
 * from the most recent Prep Run, calculates combined ordering quantities,
 * and creates Stock Order records.
 *
 * Formula per item:
 *   Total On Hand   = SUM(Stock Count qty across all locations)
 *   Service Shortfall = MAX(0, Par Qty - Total On Hand)
 *   Prep Usage      = SUM(Ingredient Requirements for this item from latest Prep Run)
 *   Combined Order  = Service Shortfall + Prep Usage
 *
 * Trigger: Runs after Validate Stock Count sets status to "Validated"
 * Inputs:  sessionId (string, auto-detects latest "Validated" session if omitted), dryRun (boolean, defaults false)
 */

// ── INPUT ──────────────────────────────────────────────────────────
const INPUT = (() => {
  try {
    return (typeof input !== "undefined" && input?.config) ? input.config() : {};
  } catch (e) {
    console.log("Warning: Could not load input config, using defaults");
    return {};
  }
})();

const dryRun = INPUT.dryRun === true;
const sessionIdInput = INPUT.sessionId || null;

// ── CONFIG ─────────────────────────────────────────────────────────
const CONFIG = {
  timeZone: "Australia/Sydney",
  scriptName: "WARATAH - GENERATE STOCK ORDERS",

  // Tables
  itemsTableName: "Items",
  parLevelsTableName: "Par Levels",
  countSessionsTableName: "Count Sessions",
  stockCountsTableName: "Stock Counts",
  stockOrdersTableName: "Stock Orders",
  prepRunsTableName: "Prep Runs",
  ingredientReqTableName: "Ingredient Requirements",
  supplierTableName: "Supplier",
  auditLogTableName: "Audit Log",

  // Items fields
  itemNameField: "Item Name",
  itemBarStockField: "Bar Stock",
  itemTypeField: "Item Type",
  itemSupplierField: "Supplier",
  itemParLevelsField: "Par Levels",

  // Par Levels fields
  parItemLinkField: "Item Link",
  parQtyField: "Par Qty",
  parActiveField: "Active",

  // Count Sessions fields
  sessionDateField: "Session Date",
  sessionStatusField: "Status",
  sessionCountedByField: "Counted By",
  sessionStockCountsField: "Stock Counts",
  sessionStockOrdersField: "Stock Orders",

  // Stock Counts fields
  countItemField: "Item",
  countQuantityField: "Total On Hand",

  // Stock Orders fields
  orderNameField: "Name",
  orderItemField: "Item",
  orderSessionField: "Count Session",
  orderOnHandField: "Total On Hand",
  orderPrepUsageField: "Prep Usage",
  orderParQtyField: "Prep Qty",        // Airtable field stores the bar stock par level for this item
  orderServiceShortfallField: "Service Shortfall",
  orderCombinedField: "Combined Order Qty",
  orderSupplierStaticField: "Supplier Name (Static)",
  orderCategoryStaticField: "Product Category (Static)",
  orderStaffStaticField: "Ordering Staff (Static)",
  orderStatusField: "Status",

  // Prep Runs fields
  prepRunWeekField: "Prep Week",

  // Ingredient Requirements fields
  irPrepRunField: "Prep Run",
  irItemLinkField: "Item Link",
  irTotalQtyField: "Total Qty Needed",

  // Supplier fields
  supplierNameField: "Supplier Name",
  supplierCategoryField: "Product Category",
  supplierOrderingStaffField: "Ordering Staff",

  // Audit Log fields
  auditTimestampField: "Timestamp",
  auditScriptNameField: "Script Name",
  auditStatusField: "Status",
  auditMessageField: "Message",
  auditDetailsField: "Details",
  auditUserField: "User",
  auditExecutionTimeField: "Execution Time (seconds)",
  auditErrorStackField: "Error Stack",
  auditConfigUsedField: "Config Used",

  // Behaviour
  batchSize: 50,
  prepRunLookbackDays: 7,   // Only look at Prep Runs within last 7 days
};

// ── HELPERS ─────────────────────────────────────────────────────────

const safeGetTable_ = (name) => {
  try { return base.getTable(name); } catch (e) { return null; }
};

const safeField_ = (table, fieldName) => {
  try { return table.getField(fieldName); } catch (e) { return null; }
};

const formatSydneyTimestamp_ = (date) => {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: CONFIG.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(date).replace(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
};

const batchCreate_ = async (table, records) => {
  const created = [];
  for (let i = 0; i < records.length; i += CONFIG.batchSize) {
    const chunk = records.slice(i, i + CONFIG.batchSize);
    const ids = await table.createRecordsAsync(chunk);
    created.push(...ids);
  }
  return created;
};

const writeAuditLog_ = async (auditLogTable, logEntry) => {
  if (!auditLogTable) {
    throw new Error("Audit Log table not found. Please create it before running this script.");
  }

  const fields = {};

  const timestampField = safeField_(auditLogTable, CONFIG.auditTimestampField);
  if (timestampField) fields[CONFIG.auditTimestampField] = new Date();

  try {
    const scriptField = auditLogTable.getField(CONFIG.auditScriptNameField);
    const scriptName = logEntry.scriptName || CONFIG.scriptName;
    if (scriptField.type === "singleSelect") {
      const options = scriptField.options.choices.map(c => c.name);
      if (options.includes(scriptName)) {
        fields[CONFIG.auditScriptNameField] = { name: scriptName };
      } else if (options.length > 0) {
        fields[CONFIG.auditScriptNameField] = { name: options[0] };
      }
    } else {
      fields[CONFIG.auditScriptNameField] = scriptName;
    }
  } catch (e) {
    console.log(`Warning: Could not set Script Name: ${e.message}`);
  }

  try {
    const statusField = auditLogTable.getField(CONFIG.auditStatusField);
    if (statusField.type === "singleSelect") {
      fields[CONFIG.auditStatusField] = { name: logEntry.status };
    } else {
      fields[CONFIG.auditStatusField] = logEntry.status;
    }
  } catch (e) {
    console.log(`Warning: Could not set Status: ${e.message}`);
  }

  if (logEntry.message) fields[CONFIG.auditMessageField] = logEntry.message;
  if (logEntry.details) fields[CONFIG.auditDetailsField] = logEntry.details;
  if (logEntry.user) {
    const userField = safeField_(auditLogTable, CONFIG.auditUserField);
    if (userField) fields[CONFIG.auditUserField] = String(logEntry.user).substring(0, 100);
  }
  if (logEntry.executionTime != null) {
    const execField = safeField_(auditLogTable, CONFIG.auditExecutionTimeField);
    if (execField && execField.type === "number") fields[CONFIG.auditExecutionTimeField] = logEntry.executionTime;
  }
  if (logEntry.errorStack) {
    const stackField = safeField_(auditLogTable, CONFIG.auditErrorStackField);
    if (stackField) fields[CONFIG.auditErrorStackField] = logEntry.errorStack;
  }
  if (logEntry.configUsed) {
    const configField = safeField_(auditLogTable, CONFIG.auditConfigUsedField);
    if (configField) fields[CONFIG.auditConfigUsedField] = logEntry.configUsed;
  }

  await auditLogTable.createRecordAsync(fields);
};

// ── MAIN ────────────────────────────────────────────────────────────

const main = async () => {
  const startTime = Date.now();

  console.log("========================================");
  console.log("WARATAH - GENERATE STOCK ORDERS");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Session ID: ${sessionIdInput || "(auto-detect)"}`);
  console.log("");

  // ── Phase 1: Load tables ──
  console.log("Phase 1: Loading tables...");

  const itemsTable = base.getTable(CONFIG.itemsTableName);
  const parLevelsTable = base.getTable(CONFIG.parLevelsTableName);
  const sessionsTable = base.getTable(CONFIG.countSessionsTableName);
  const countsTable = base.getTable(CONFIG.stockCountsTableName);
  const ordersTable = base.getTable(CONFIG.stockOrdersTableName);
  const prepRunsTable = safeGetTable_(CONFIG.prepRunsTableName);
  const irTable = safeGetTable_(CONFIG.ingredientReqTableName);
  const supplierTable = safeGetTable_(CONFIG.supplierTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  console.log("  OK");
  console.log("");

  // ── Phase 2: Find target session ──
  console.log("Phase 2: Finding validated session...");

  const sessionsQuery = await sessionsTable.selectRecordsAsync({
    fields: [CONFIG.sessionDateField, CONFIG.sessionStatusField, CONFIG.sessionCountedByField, CONFIG.sessionStockCountsField],
  });

  let targetSession = null;

  if (sessionIdInput) {
    targetSession = sessionsQuery.records.find(r => r.id === sessionIdInput);
    if (!targetSession) throw new Error(`Session not found: ${sessionIdInput}`);
  } else {
    const candidates = sessionsQuery.records.filter(r => {
      const status = r.getCellValue(CONFIG.sessionStatusField);
      return status?.name === "Validated" || status?.name === "Orders Generated";
    });

    if (candidates.length === 0) {
      throw new Error("No validated session found. Run Validate Stock Count first.");
    }

    candidates.sort((a, b) => {
      const da = a.getCellValue(CONFIG.sessionDateField) || "";
      const db = b.getCellValue(CONFIG.sessionDateField) || "";
      return db.localeCompare(da);
    });

    targetSession = candidates[0];
  }

  // Allow re-run on "Orders Generated" sessions — Phase 8 will clean up old orders first
  const targetStatus = targetSession.getCellValue(CONFIG.sessionStatusField);
  if (targetStatus?.name === "Orders Generated") {
    console.log("  Session already has orders — will be regenerated (old orders deleted in Phase 8)");
  }

  const sessionDate = targetSession.getCellValue(CONFIG.sessionDateField);
  const countedBy = targetSession.getCellValue(CONFIG.sessionCountedByField);

  console.log(`  Session: ${targetSession.id}`);
  console.log(`  Date: ${sessionDate}`);
  console.log(`  Counted By: ${countedBy?.name || "(Unknown)"}`);
  console.log("");

  // ── Phase 3: Aggregate stock counts by item ──
  console.log("Phase 3: Aggregating stock counts by item...");

  const linkedCountRefs = targetSession.getCellValue(CONFIG.sessionStockCountsField);
  if (!linkedCountRefs || linkedCountRefs.length === 0) {
    throw new Error("Session has no linked Stock Count records.");
  }

  const linkedIds = new Set(linkedCountRefs.map(l => l.id));

  const countsQuery = await countsTable.selectRecordsAsync({
    fields: [CONFIG.countItemField, CONFIG.countQuantityField],
  });

  // itemId -> total on hand (sum across locations)
  const onHandByItem = new Map();

  for (const rec of countsQuery.records) {
    if (!linkedIds.has(rec.id)) continue;

    const itemRef = rec.getCellValue(CONFIG.countItemField);
    const qty = rec.getCellValue(CONFIG.countQuantityField);
    if (!itemRef || itemRef.length === 0) continue;

    const itemId = itemRef[0].id;
    const current = onHandByItem.get(itemId) || 0;
    onHandByItem.set(itemId, current + (qty || 0));
  }

  console.log(`  Aggregated ${onHandByItem.size} unique items from ${linkedCountRefs.length} count records`);
  console.log("");

  // ── Phase 4: Fetch Par Levels ──
  console.log("Phase 4: Fetching par levels...");

  const parQuery = await parLevelsTable.selectRecordsAsync({
    fields: [CONFIG.parItemLinkField, CONFIG.parQtyField, CONFIG.parActiveField],
  });

  // itemId -> par qty
  const parByItem = new Map();
  for (const rec of parQuery.records) {
    const active = rec.getCellValue(CONFIG.parActiveField);
    if (!active) continue;

    const itemLink = rec.getCellValue(CONFIG.parItemLinkField);
    if (!itemLink || itemLink.length === 0) continue;

    const itemId = itemLink[0].id;
    const parQty = rec.getCellValue(CONFIG.parQtyField) || 0;

    // If multiple par levels exist for an item, use the highest
    const existing = parByItem.get(itemId) || 0;
    if (parQty > existing) {
      parByItem.set(itemId, parQty);
    }
  }

  console.log(`  Loaded ${parByItem.size} active par levels`);
  console.log("");

  // ── Phase 5: Fetch Prep Usage from latest Prep Run ──
  console.log("Phase 5: Looking up prep usage...");

  // itemId -> total prep qty needed (sum across all recipes)
  const prepUsageByItem = new Map();

  if (prepRunsTable && irTable) {
    const prepRunsQuery = await prepRunsTable.selectRecordsAsync({
      fields: [CONFIG.prepRunWeekField],
    });

    // Find the most recent Prep Run within lookback window
    const now = new Date();
    const cutoffMs = now.getTime() - (CONFIG.prepRunLookbackDays * 24 * 60 * 60 * 1000);

    let latestRun = null;
    let latestDate = null;

    for (const run of prepRunsQuery.records) {
      const weekVal = run.getCellValue(CONFIG.prepRunWeekField);
      if (!weekVal) continue;

      const runDate = new Date(weekVal);
      if (!Number.isFinite(runDate.getTime())) continue;
      if (runDate.getTime() < cutoffMs) continue;

      if (!latestDate || runDate > latestDate) {
        latestDate = runDate;
        latestRun = run;
      }
    }

    if (latestRun) {
      console.log(`  Found Prep Run: ${latestDate.toISOString().split("T")[0]} (${latestRun.id})`);

      // Fetch Ingredient Requirements for this Prep Run
      const irQuery = await irTable.selectRecordsAsync({
        fields: [CONFIG.irPrepRunField, CONFIG.irItemLinkField, CONFIG.irTotalQtyField],
      });

      for (const ir of irQuery.records) {
        const runRef = ir.getCellValue(CONFIG.irPrepRunField);
        if (!runRef || runRef.length === 0 || runRef[0].id !== latestRun.id) continue;

        const itemRef = ir.getCellValue(CONFIG.irItemLinkField);
        if (!itemRef || itemRef.length === 0) continue;

        const itemId = itemRef[0].id;
        const totalQty = ir.getCellValue(CONFIG.irTotalQtyField) || 0;

        // SUM across all recipes (same item can appear in multiple)
        const existing = prepUsageByItem.get(itemId) || 0;
        prepUsageByItem.set(itemId, existing + totalQty);
      }

      console.log(`  Loaded prep usage for ${prepUsageByItem.size} items`);
    } else {
      console.log("  No Prep Run found within last 7 days — prep usage will be 0");
    }
  } else {
    console.log("  Prep Runs or Ingredient Requirements table not found — prep usage will be 0");
  }
  console.log("");

  // ── Phase 6: Fetch item metadata (names, suppliers) ──
  console.log("Phase 6: Loading item metadata...");

  const itemsQuery = await itemsTable.selectRecordsAsync({
    fields: [CONFIG.itemNameField, CONFIG.itemBarStockField, CONFIG.itemTypeField, CONFIG.itemSupplierField],
  });

  const itemMeta = new Map();
  for (const item of itemsQuery.records) {
    itemMeta.set(item.id, {
      name: item.getCellValue(CONFIG.itemNameField) || "(Unknown)",
      type: item.getCellValue(CONFIG.itemTypeField)?.name || "",
      supplierRef: item.getCellValue(CONFIG.itemSupplierField),
    });
  }

  // Build supplier metadata lookup
  let supplierMeta = new Map();
  if (supplierTable) {
    const supplierQuery = await supplierTable.selectRecordsAsync({
      fields: [CONFIG.supplierNameField, CONFIG.supplierCategoryField, CONFIG.supplierOrderingStaffField],
    });

    for (const sup of supplierQuery.records) {
      supplierMeta.set(sup.id, {
        name: sup.getCellValue(CONFIG.supplierNameField) || "",
        category: sup.getCellValue(CONFIG.supplierCategoryField)?.name || "",
        orderingStaff: sup.getCellValue(CONFIG.supplierOrderingStaffField)?.name || "",
      });
    }
  }

  console.log(`  Loaded metadata for ${itemMeta.size} items, ${supplierMeta.size} suppliers`);
  console.log("");

  // ── Phase 7: Calculate orders ──
  console.log("Phase 7: Calculating order quantities...");

  const orderRecords = [];
  let itemsWithOrders = 0;
  let itemsNoOrder = 0;
  let totalCombinedQty = 0;

  for (const [itemId, onHand] of onHandByItem) {
    const meta = itemMeta.get(itemId);
    if (!meta) continue;

    const parQty = parByItem.get(itemId) || 0;
    const prepUsage = prepUsageByItem.get(itemId) || 0;

    // Core formula
    const serviceShortfall = Math.max(0, parQty - onHand);
    const combinedOrder = serviceShortfall + prepUsage;

    // Resolve supplier metadata
    let supplierName = "";
    let productCategory = "";
    let orderingStaff = "";
    if (meta.supplierRef && meta.supplierRef.length > 0) {
      const supData = supplierMeta.get(meta.supplierRef[0].id);
      if (supData) {
        supplierName = supData.name;
        productCategory = supData.category;
        orderingStaff = supData.orderingStaff;
      }
    }

    const fields = {
      [CONFIG.orderItemField]: [{ id: itemId }],
      [CONFIG.orderSessionField]: [{ id: targetSession.id }],
      [CONFIG.orderOnHandField]: onHand,
      [CONFIG.orderPrepUsageField]: prepUsage,
      [CONFIG.orderParQtyField]: parQty,
      [CONFIG.orderServiceShortfallField]: serviceShortfall,
      [CONFIG.orderCombinedField]: combinedOrder,
    };

    // Static supplier fields (denormalized for ordering doc)
    const supNameField = safeField_(ordersTable, CONFIG.orderSupplierStaticField);
    if (supNameField) fields[CONFIG.orderSupplierStaticField] = supplierName;

    const catField = safeField_(ordersTable, CONFIG.orderCategoryStaticField);
    if (catField) fields[CONFIG.orderCategoryStaticField] = productCategory;

    const staffField = safeField_(ordersTable, CONFIG.orderStaffStaticField);
    if (staffField) fields[CONFIG.orderStaffStaticField] = orderingStaff;

    // Status: Pending if needs ordering, No Order Needed if combined = 0
    const statusField = safeField_(ordersTable, CONFIG.orderStatusField);
    if (statusField && statusField.type === "singleSelect") {
      if (combinedOrder > 0) {
        fields[CONFIG.orderStatusField] = { name: "Pending" };
        itemsWithOrders++;
        totalCombinedQty += combinedOrder;
      } else {
        fields[CONFIG.orderStatusField] = { name: "No Order Needed" };
        itemsNoOrder++;
      }
    }

    orderRecords.push({ fields });
  }

  console.log(`  Items needing orders: ${itemsWithOrders}`);
  console.log(`  Items with no order needed: ${itemsNoOrder}`);
  console.log(`  Total combined order qty: ${totalCombinedQty}`);
  console.log("");

  // ── Phase 8: Delete existing Stock Orders for this session (idempotent re-run) ──
  console.log("Phase 8: Cleaning up existing orders for this session...");

  if (!dryRun) {
    const existingOrderRefs = targetSession.getCellValue(CONFIG.sessionStockOrdersField);
    if (existingOrderRefs && existingOrderRefs.length > 0) {
      const existingIds = existingOrderRefs.map(r => r.id);
      console.log(`  Found ${existingIds.length} existing Stock Order records — deleting...`);
      for (let i = 0; i < existingIds.length; i += CONFIG.batchSize) {
        const chunk = existingIds.slice(i, i + CONFIG.batchSize);
        await ordersTable.deleteRecordsAsync(chunk);
      }
      console.log(`  Deleted ${existingIds.length} old records`);
    } else {
      console.log("  No existing orders to clean up");
    }
  } else {
    console.log("  [DRY RUN] Would delete existing orders for this session");
  }
  console.log("");

  // ── Phase 9: Create Stock Order records ──
  console.log("Phase 9: Creating Stock Order records...");

  if (!dryRun && orderRecords.length > 0) {
    const createdIds = await batchCreate_(ordersTable, orderRecords);
    console.log(`  Created ${createdIds.length} Stock Order records`);
  } else if (dryRun) {
    console.log(`  [DRY RUN] Would create ${orderRecords.length} Stock Order records`);
  } else {
    console.log("  No order records to create");
  }
  console.log("");

  // ── Phase 10: Update session status ──
  console.log("Phase 10: Updating session status...");

  if (!dryRun) {
    const sessionUpdateFields = {};
    const sField = safeField_(sessionsTable, CONFIG.sessionStatusField);
    if (sField && sField.type === "singleSelect") {
      sessionUpdateFields[CONFIG.sessionStatusField] = { name: "Orders Generated" };
    }

    await sessionsTable.updateRecordAsync(targetSession.id, sessionUpdateFields);
    console.log('  Session status -> "Orders Generated"');
  } else {
    console.log('  [DRY RUN] Would set status to "Orders Generated"');
  }
  console.log("");

  // ── Phase 11: Summary ──
  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log("========================================");
  console.log("GENERATE STOCK ORDERS - COMPLETE");
  console.log("========================================");
  console.log(`Session: ${sessionDate}`);
  console.log(`Items Counted: ${onHandByItem.size}`);
  console.log(`Par Levels Found: ${parByItem.size}`);
  console.log(`Prep Usage Items: ${prepUsageByItem.size}`);
  console.log(`Orders Created: ${orderRecords.length}`);
  console.log(`  Needing Order: ${itemsWithOrders}`);
  console.log(`  No Order: ${itemsNoOrder}`);
  console.log(`Total Combined Qty: ${totalCombinedQty}`);
  console.log(`Execution Time: ${executionTime}s`);
  console.log("");

  // ── Phase 12: Audit Log ──
  if (!dryRun && auditLogTable) {
    await writeAuditLog_(auditLogTable, {
      scriptName: CONFIG.scriptName,
      status: "SUCCESS",
      message: `Generated ${orderRecords.length} orders (${itemsWithOrders} needing ordering, combined qty: ${totalCombinedQty})`,
      details: [
        `Session Date: ${sessionDate}`,
        `Items Counted: ${onHandByItem.size}`,
        `Par Levels: ${parByItem.size}`,
        `Prep Usage Items: ${prepUsageByItem.size}`,
        `Orders Created: ${orderRecords.length}`,
        `Needing Order: ${itemsWithOrders}`,
        `No Order Needed: ${itemsNoOrder}`,
        `Total Combined Qty: ${totalCombinedQty}`,
      ].join("\n"),
      user: countedBy?.name || "(Unknown)",
      executionTime: parseFloat(executionTime),
      configUsed: JSON.stringify({ dryRun, sessionIdInput, prepRunLookbackDays: CONFIG.prepRunLookbackDays }, null, 2),
    });
  }

  // Output for Airtable interface
  output.set("status", "success");
  output.set("ordersCreated", orderRecords.length);
  output.set("ordersNeeded", itemsWithOrders);
  output.set("ordersNotNeeded", itemsNoOrder);
  output.set("totalCombinedQty", totalCombinedQty);
  output.set("executionTime", executionTime);
};

// ── EXECUTION WRAPPER ──────────────────────────────────────────────

(async () => {
  const startTime = Date.now();
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  try {
    await main();
  } catch (err) {
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";

    console.log("");
    console.log("========================================");
    console.log("GENERATE STOCK ORDERS - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log(`Execution time: ${executionTime}s`);
    console.log("");

    if (!dryRun && auditLogTable) {
      try {
        await writeAuditLog_(auditLogTable, {
          scriptName: CONFIG.scriptName,
          status: "ERROR",
          message: `Script failed: ${errorMessage}`,
          user: "(Error before user capture)",
          executionTime: parseFloat(executionTime),
          errorStack,
          configUsed: JSON.stringify({ dryRun, sessionIdInput }, null, 2),
        });
      } catch (logErr) {
        console.log(`Warning: Could not write error to Audit Log: ${logErr.message}`);
      }
    }

    output.set("status", "error");
    output.set("message", errorMessage);
    throw err;
  }
})();
