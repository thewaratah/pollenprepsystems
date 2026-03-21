/**
 * Waratah_CompleteStockCount.gs
 *
 * Airtable Automation Script — runs INSIDE Airtable (not GAS).
 * Button-triggered script that advances the current "In Progress" Count Session
 * to "Completed", which triggers the ValidateStockCount automation.
 *
 * Guards: refuses to complete if Total On Hand is null on any Stock Count record
 * (i.e., if any item has no tallies entered at all).
 *
 * Trigger: Manual button on Count Sessions interface
 * Inputs:  sessionId (string, auto-detects latest "In Progress" session if omitted), dryRun (boolean, defaults false)
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
  scriptName: "WARATAH - COMPLETE STOCK COUNT",

  // Tables
  countSessionsTableName: "Count Sessions",
  stockCountsTableName: "Stock Counts",
  auditLogTableName: "Audit Log",

  // Count Sessions fields
  sessionDateField: "Session Date",
  sessionStatusField: "Status",
  sessionCountedByField: "Counted By",
  sessionStockCountsField: "Stock Counts",

  // Stock Counts fields
  countItemField: "Item",
  countQuantityField: "Total On Hand",

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
  console.log("WARATAH - COMPLETE STOCK COUNT");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Session ID: ${sessionIdInput || "(auto-detect)"}`);
  console.log("");

  // ── Phase 1: Load tables ──
  console.log("Phase 1: Loading tables...");

  const sessionsTable = base.getTable(CONFIG.countSessionsTableName);
  const countsTable = base.getTable(CONFIG.stockCountsTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  console.log("  OK");
  console.log("");

  // ── Phase 2: Find target session ──
  console.log("Phase 2: Finding In Progress session...");

  const sessionsQuery = await sessionsTable.selectRecordsAsync({
    fields: [CONFIG.sessionDateField, CONFIG.sessionStatusField, CONFIG.sessionCountedByField, CONFIG.sessionStockCountsField],
  });

  let targetSession = null;

  if (sessionIdInput) {
    targetSession = sessionsQuery.records.find(r => r.id === sessionIdInput);
    if (!targetSession) {
      throw new Error(`Session not found: ${sessionIdInput}`);
    }
  } else {
    // Auto-detect: find most recent "In Progress" session
    const candidates = sessionsQuery.records.filter(r => {
      const status = r.getCellValue(CONFIG.sessionStatusField);
      return status?.name === "In Progress";
    });

    if (candidates.length === 0) {
      throw new Error('No session with status "In Progress" found. Run Init Stock Count first.');
    }

    candidates.sort((a, b) => {
      const da = a.getCellValue(CONFIG.sessionDateField) || "";
      const db = b.getCellValue(CONFIG.sessionDateField) || "";
      return db.localeCompare(da);
    });

    targetSession = candidates[0];
  }

  const sessionDate = targetSession.getCellValue(CONFIG.sessionDateField);
  const sessionStatus = targetSession.getCellValue(CONFIG.sessionStatusField);
  const countedBy = targetSession.getCellValue(CONFIG.sessionCountedByField);

  console.log(`  Session: ${targetSession.id}`);
  console.log(`  Date: ${sessionDate}`);
  console.log(`  Status: ${sessionStatus?.name || "(none)"}`);
  console.log(`  Counted By: ${countedBy?.name || "(none)"}`);

  // Guard: only allow completing "In Progress" sessions
  if (sessionStatus?.name !== "In Progress") {
    const msg = `Session status is "${sessionStatus?.name || "(none)"}", not "In Progress". Cannot complete.`;
    console.log(`  BLOCKED: ${msg}`);
    output.set("status", "blocked");
    output.set("message", msg);
    return;
  }
  console.log("");

  // ── Phase 3: Pre-flight check — are all items counted? ──
  console.log("Phase 3: Checking for uncounted items...");

  const linkedCountRefs = targetSession.getCellValue(CONFIG.sessionStockCountsField);
  if (!linkedCountRefs || linkedCountRefs.length === 0) {
    throw new Error("Session has no linked Stock Count records. Run Init Stock Count first.");
  }

  const linkedIds = new Set(linkedCountRefs.map(l => l.id));

  const countsQuery = await countsTable.selectRecordsAsync({
    fields: [CONFIG.countItemField, CONFIG.countQuantityField],
  });

  const sessionCounts = countsQuery.records.filter(r => linkedIds.has(r.id));

  // Check for items with no tallies (Total On Hand formula returns null/BLANK)
  const uncounted = [];
  let countedItems = 0;

  for (const rec of sessionCounts) {
    const qty = rec.getCellValue(CONFIG.countQuantityField);
    const itemRef = rec.getCellValue(CONFIG.countItemField);
    const itemName = itemRef && itemRef[0] ? itemRef[0].name || "(Unknown)" : "(No item)";

    if (qty == null) {
      uncounted.push(itemName);
    } else {
      countedItems++;
    }
  }

  console.log(`  Total items: ${sessionCounts.length}`);
  console.log(`  Counted: ${countedItems}`);
  console.log(`  Uncounted: ${uncounted.length}`);

  if (uncounted.length > 0) {
    console.log("");
    console.log("  Uncounted items (no tallies entered):");
    for (const name of uncounted.slice(0, 20)) {
      console.log(`    - ${name}`);
    }
    if (uncounted.length > 20) {
      console.log(`    ... and ${uncounted.length - 20} more`);
    }

    const msg = `${uncounted.length} item(s) have no tallies entered. Enter counts for all items before completing.`;
    console.log("");
    console.log(`  BLOCKED: ${msg}`);

    if (!dryRun && auditLogTable) {
      await writeAuditLog_(auditLogTable, {
        status: "WARNING",
        message: msg,
        details: `Uncounted items:\n${uncounted.slice(0, 30).join("\n")}`,
        user: countedBy?.name || "Evan",
        executionTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(2)),
      });
    }

    output.set("status", "blocked");
    output.set("message", msg);
    output.set("uncountedItems", uncounted.length);
    return;
  }
  console.log("");

  // ── Phase 4: Update session status to "Completed" ──
  console.log("Phase 4: Marking session as Completed...");

  if (!dryRun) {
    const sField = safeField_(sessionsTable, CONFIG.sessionStatusField);
    if (sField && sField.type === "singleSelect") {
      await sessionsTable.updateRecordAsync(targetSession.id, {
        [CONFIG.sessionStatusField]: { name: "Completed" },
      });
      console.log('  Session status -> "Completed"');
      console.log("  ValidateStockCount automation will trigger automatically.");
    } else {
      throw new Error(`Cannot update Status field: field ${sField ? "is type " + sField.type : "not found"}. Expected singleSelect.`);
    }
  } else {
    console.log('  [DRY RUN] Would set status to "Completed"');
  }
  console.log("");

  // ── Phase 5: Summary ──
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("========================================");
  console.log("COMPLETE STOCK COUNT - DONE");
  console.log("========================================");
  console.log(`Session: ${sessionDate}`);
  console.log(`Items Counted: ${countedItems} / ${sessionCounts.length}`);
  console.log(`Execution Time: ${executionTime}s`);
  console.log("");
  console.log("Next: ValidateStockCount will run automatically.");
  console.log("If validation passes → GenerateStockOrders runs → then trigger ordering doc export.");
  console.log("");

  // ── Phase 6: Audit Log ──
  if (!dryRun && auditLogTable) {
    await writeAuditLog_(auditLogTable, {
      status: "SUCCESS",
      message: `Completed stock count: ${countedItems} items counted`,
      details: [
        `Session Date: ${sessionDate}`,
        `Items Counted: ${countedItems} / ${sessionCounts.length}`,
        `Counted By: ${countedBy?.name || "Evan"}`,
      ].join("\n"),
      user: countedBy?.name || "Evan",
      executionTime: parseFloat(executionTime),
      configUsed: JSON.stringify({ dryRun, sessionIdInput }, null, 2),
    });
  }

  output.set("status", "success");
  output.set("message", `Completed: ${countedItems} items counted. Validation will run automatically.`);
  output.set("countedItems", countedItems);
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
    console.log("COMPLETE STOCK COUNT - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log(`Execution time: ${executionTime}s`);
    console.log("");

    if (!dryRun && auditLogTable) {
      try {
        await writeAuditLog_(auditLogTable, {
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
