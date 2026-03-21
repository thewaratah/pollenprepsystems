/**
 * Waratah_InitStockCount.gs
 *
 * Airtable Automation Script — runs INSIDE Airtable (not GAS).
 * Creates a new Count Session and one Stock Count placeholder record
 * per active Core Order item (no location breakdown — one record per item).
 * Archives sessions older than 4 weeks.
 *
 * Trigger: Manual button or scheduled automation (Monday AM)
 * Inputs:  dryRun (boolean, defaults false), countedBy (string, defaults "Evan")
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
const countedByInput = INPUT.countedBy || "Evan"; // Default when automation can't pass string inputs

// ── CONFIG ─────────────────────────────────────────────────────────
const CONFIG = {
  timeZone: "Australia/Sydney",
  scriptName: "WARATAH - INIT STOCK COUNT",

  // Tables
  itemsTableName: "Items",
  countSessionsTableName: "Count Sessions",
  stockCountsTableName: "Stock Counts",
  stockOrdersTableName: "Stock Orders",
  auditLogTableName: "Audit Log",

  // Items fields
  itemNameField: "Item Name",
  itemBarStockField: "Bar Stock",
  itemCoreOrderField: "Core Order",
  itemActiveField: "Active",
  itemTypeField: "Item Type",

  // Count Sessions fields
  sessionDateField: "Session Date",
  sessionStatusField: "Status",
  sessionCountedByField: "Counted By",
  sessionNotesField: "Notes",
  sessionStockCountsField: "Stock Counts",

  // Stock Counts fields
  countItemField: "Item",
  countSessionField: "Count Session",
  countQuantityField: "Quantity",
  countPreviousField: "Previous Count",
  countNeedsReviewField: "Needs Review",

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
  archiveWeeks: 4,
  allowedStatuses: ["Not Started", "In Progress"],
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

const batchDelete_ = async (table, recordIds) => {
  for (let i = 0; i < recordIds.length; i += CONFIG.batchSize) {
    const chunk = recordIds.slice(i, i + CONFIG.batchSize);
    await table.deleteRecordsAsync(chunk);
  }
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
        console.log(`Warning: "${scriptName}" not in Audit Log select options, using "${options[0]}"`);
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
    if (execField && execField.type === "number") {
      fields[CONFIG.auditExecutionTimeField] = logEntry.executionTime;
    }
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
  console.log("WARATAH - INIT STOCK COUNT");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Counted By: ${countedByInput || "(not set)"}`);
  console.log("");

  // ── Phase 1: Load tables ──
  console.log("Phase 1: Loading tables...");

  const itemsTable = base.getTable(CONFIG.itemsTableName);
  const sessionsTable = base.getTable(CONFIG.countSessionsTableName);
  const countsTable = base.getTable(CONFIG.stockCountsTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  console.log("  OK");
  console.log("");

  // ── Phase 2: Check for existing open session ──
  console.log("Phase 2: Checking for open sessions...");

  const existingSessions = await sessionsTable.selectRecordsAsync({
    fields: [CONFIG.sessionDateField, CONFIG.sessionStatusField, CONFIG.sessionStockCountsField],
  });

  const openSessions = existingSessions.records.filter(r => {
    const status = r.getCellValue(CONFIG.sessionStatusField);
    const statusName = status?.name || "";
    return CONFIG.allowedStatuses.includes(statusName) || statusName === "";
  });

  if (openSessions.length > 0) {
    const openDate = openSessions[0].getCellValue(CONFIG.sessionDateField);
    const msg = `Found ${openSessions.length} open session(s). Most recent: ${openDate || "no date"}. Complete or archive existing sessions before creating a new one.`;
    console.log(`  BLOCKED: ${msg}`);

    if (!dryRun && auditLogTable) {
      await writeAuditLog_(auditLogTable, {
        scriptName: CONFIG.scriptName,
        status: "WARNING",
        message: msg,
        user: countedByInput,
        executionTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2)),
        configUsed: JSON.stringify({ dryRun, countedByInput }, null, 2),
      });
    }

    output.set("status", "blocked");
    output.set("message", msg);
    return;
  }

  console.log("  No open sessions found");
  console.log("");

  // ── Phase 3: Fetch Core Order items ──
  console.log("Phase 3: Fetching Core Order items...");

  const itemsQuery = await itemsTable.selectRecordsAsync({
    fields: [CONFIG.itemNameField, CONFIG.itemCoreOrderField, CONFIG.itemBarStockField, CONFIG.itemTypeField, CONFIG.itemActiveField],
  });

  const coreOrderItems = itemsQuery.records.filter(r => {
    return r.getCellValue(CONFIG.itemCoreOrderField) === true
      && r.getCellValue(CONFIG.itemActiveField) !== false;
  });

  console.log(`  Found ${coreOrderItems.length} items with Core Order = true`);
  console.log("");

  if (coreOrderItems.length === 0) {
    const msg = "No items with Core Order = true found. Check the Core Order checkbox on items you want to count.";
    console.log(`  BLOCKED: ${msg}`);
    output.set("status", "blocked");
    output.set("message", msg);
    return;
  }

  // ── Phase 4: Fetch previous counts for pre-fill ──
  console.log("Phase 4: Looking up previous counts...");

  // Find the most recent completed session
  const allSessions = existingSessions.records.filter(r => {
    const status = r.getCellValue(CONFIG.sessionStatusField);
    return status?.name === "Orders Generated" || status?.name === "Completed" || status?.name === "Validated";
  });

  // key: itemId -> qty (one record per item, no location breakdown)
  let previousCountMap = new Map();

  if (allSessions.length > 0) {
    // Sort by date descending to get most recent
    allSessions.sort((a, b) => {
      const da = a.getCellValue(CONFIG.sessionDateField) || "";
      const db = b.getCellValue(CONFIG.sessionDateField) || "";
      return db.localeCompare(da);
    });

    const lastSession = allSessions[0];
    const lastSessionDate = lastSession.getCellValue(CONFIG.sessionDateField);
    console.log(`  Found previous session: ${lastSessionDate}`);

    // Get linked stock counts from previous session
    const linkedCounts = lastSession.getCellValue(CONFIG.sessionStockCountsField);
    if (linkedCounts && linkedCounts.length > 0) {
      const prevCountsQuery = await countsTable.selectRecordsAsync({
        fields: [CONFIG.countItemField, CONFIG.countQuantityField],
      });

      const linkedIds = new Set(linkedCounts.map(l => l.id));
      for (const rec of prevCountsQuery.records) {
        if (!linkedIds.has(rec.id)) continue;
        const item = rec.getCellValue(CONFIG.countItemField);
        const qty = rec.getCellValue(CONFIG.countQuantityField);
        if (item && item.length > 0 && qty != null) {
          const itemId = item[0].id;
          // Sum across any old location-based records from previous sessions
          const existing = previousCountMap.get(itemId) || 0;
          previousCountMap.set(itemId, existing + qty);
        }
      }
      console.log(`  Loaded ${previousCountMap.size} previous counts`);
    }
  } else {
    console.log("  No previous completed session found (first run)");
  }
  console.log("");

  // ── Phase 5: Create Count Session ──
  console.log("Phase 5: Creating Count Session...");

  const sessionDate = new Date();
  const sessionFields = {
    [CONFIG.sessionDateField]: formatSydneyTimestamp_(sessionDate).split(" ")[0],
  };

  // Status (single select)
  const statusField = safeField_(sessionsTable, CONFIG.sessionStatusField);
  if (statusField && statusField.type === "singleSelect") {
    sessionFields[CONFIG.sessionStatusField] = { name: "Not Started" };
  }

  // Counted By (single select)
  const countedByField = safeField_(sessionsTable, CONFIG.sessionCountedByField);
  if (countedByField && countedByField.type === "singleSelect") {
    sessionFields[CONFIG.sessionCountedByField] = { name: countedByInput };
  }

  let sessionRecordId = null;
  if (!dryRun) {
    sessionRecordId = await sessionsTable.createRecordAsync(sessionFields);
    console.log(`  Created session: ${sessionRecordId}`);
  } else {
    console.log("  [DRY RUN] Would create session");
  }
  console.log("");

  // ── Phase 6: Create Stock Count placeholders (one per item, no location) ──
  console.log("Phase 6: Creating Stock Count placeholders...");

  const placeholders = [];
  const prevCountField = safeField_(countsTable, CONFIG.countPreviousField);

  for (const item of coreOrderItems) {
    const itemId = item.id;

    const fields = {
      [CONFIG.countItemField]: [{ id: itemId }],
    };

    if (sessionRecordId) {
      fields[CONFIG.countSessionField] = [{ id: sessionRecordId }];
    }

    // Pre-fill previous count for this item
    if (prevCountField) {
      const prevQty = previousCountMap.get(itemId);
      if (prevQty != null) {
        fields[CONFIG.countPreviousField] = prevQty;
      }
    }

    placeholders.push({ fields });
  }

  const totalPlaceholders = placeholders.length;
  console.log(`  ${coreOrderItems.length} Core Order items → ${totalPlaceholders} placeholders`);

  if (!dryRun) {
    const createdIds = await batchCreate_(countsTable, placeholders);
    console.log(`  Created ${createdIds.length} Stock Count records`);

    // Update session status to "In Progress" — signals to Evan that counting can begin
    if (sessionRecordId) {
      const sField = safeField_(sessionsTable, CONFIG.sessionStatusField);
      if (sField && sField.type === "singleSelect") {
        await sessionsTable.updateRecordAsync(sessionRecordId, {
          [CONFIG.sessionStatusField]: { name: "In Progress" },
        });
        console.log('  Session status -> "In Progress"');
      }
    }
  } else {
    console.log(`  [DRY RUN] Would create ${placeholders.length} Stock Count records`);
  }
  console.log("");

  // ── Phase 7: Archive old sessions ──
  console.log("Phase 7: Archiving old sessions...");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (CONFIG.archiveWeeks * 7));
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  const ordersTable = safeGetTable_(CONFIG.stockOrdersTableName);
  let archivedSessions = 0;
  let archivedCounts = 0;
  let archivedOrders = 0;

  // Need Stock Orders field for cleanup
  const sessionOrdersField = safeField_(sessionsTable, "Stock Orders");

  for (const session of existingSessions.records) {
    const dateVal = session.getCellValue(CONFIG.sessionDateField);
    if (!dateVal || dateVal >= cutoffStr) continue;

    const status = session.getCellValue(CONFIG.sessionStatusField);
    const statusName = status?.name || "";
    // Only archive completed sessions
    if (statusName !== "Orders Generated" && statusName !== "Completed") continue;

    // Delete linked stock counts
    const linkedCounts = session.getCellValue(CONFIG.sessionStockCountsField);
    if (linkedCounts && linkedCounts.length > 0) {
      if (!dryRun) {
        await batchDelete_(countsTable, linkedCounts.map(l => l.id));
      }
      archivedCounts += linkedCounts.length;
    }

    // Delete linked stock orders
    if (ordersTable && sessionOrdersField) {
      const linkedOrders = session.getCellValue("Stock Orders");
      if (linkedOrders && linkedOrders.length > 0) {
        if (!dryRun) {
          await batchDelete_(ordersTable, linkedOrders.map(l => l.id));
        }
        archivedOrders += linkedOrders.length;
      }
    }

    // Delete the session itself
    if (!dryRun) {
      await sessionsTable.deleteRecordAsync(session.id);
    }
    archivedSessions++;
  }

  if (archivedSessions > 0) {
    console.log(`  ${dryRun ? "[DRY RUN] Would archive" : "Archived"} ${archivedSessions} old sessions (${archivedCounts} counts, ${archivedOrders} orders)`);
  } else {
    console.log("  No sessions older than 4 weeks to archive");
  }
  console.log("");

  // ── Phase 8: Summary ──
  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log("========================================");
  console.log("INIT STOCK COUNT - COMPLETE");
  console.log("========================================");
  console.log(`Session Date: ${formatSydneyTimestamp_(sessionDate)}`);
  console.log(`Counted By: ${countedByInput}`);
  console.log(`Core Order Items: ${coreOrderItems.length}`);
  console.log(`Placeholders Created: ${totalPlaceholders}`);
  console.log(`Previous Counts Loaded: ${previousCountMap.size}`);
  console.log(`Archived Sessions: ${archivedSessions}`);
  console.log(`Execution Time: ${executionTime}s`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  // ── Phase 9: Audit Log ──
  if (!dryRun && auditLogTable) {
    await writeAuditLog_(auditLogTable, {
      scriptName: CONFIG.scriptName,
      status: "SUCCESS",
      message: `Created session with ${totalPlaceholders} stock count placeholders from ${coreOrderItems.length} Core Order items`,
      details: [
        `Session Date: ${formatSydneyTimestamp_(sessionDate)}`,
        `Counted By: ${countedByInput}`,
        `Core Order Items: ${coreOrderItems.length}`,
        `Placeholders: ${totalPlaceholders}`,
        `Previous Counts Loaded: ${previousCountMap.size}`,
        `Archived: ${archivedSessions} sessions, ${archivedCounts} counts`,
      ].join("\n"),
      user: countedByInput,
      executionTime: parseFloat(executionTime),
      configUsed: JSON.stringify({ dryRun, countedByInput }, null, 2),
    });
  }

  // Output for Airtable interface
  output.set("status", "success");
  output.set("sessionId", sessionRecordId || "(dry run)");
  output.set("itemCount", coreOrderItems.length);
  output.set("placeholderCount", totalPlaceholders);
  output.set("archivedSessions", archivedSessions);
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
    console.log("INIT STOCK COUNT - FAILED");
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
          details: `Error during Init Stock Count.\n\nStack trace in Error Stack field.`,
          user: countedByInput,
          executionTime: parseFloat(executionTime),
          errorStack,
          configUsed: JSON.stringify({ dryRun, countedByInput }, null, 2),
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
