/**
 * Waratah_ValidateStockCount.gs
 *
 * Airtable Automation Script — runs INSIDE Airtable (not GAS).
 * Validates a completed stock count session: auto-fills blank quantities to 0,
 * flags outliers vs previous counts, and updates session status.
 *
 * Trigger: Automation on Count Session Status change to "Completed"
 * Inputs:  sessionId (string, auto-detects latest "Completed" session if omitted), dryRun (boolean, defaults false)
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
  scriptName: "WARATAH - VALIDATE STOCK COUNT",

  // Tables
  itemsTableName: "Items",
  countSessionsTableName: "Count Sessions",
  stockCountsTableName: "Stock Counts",
  auditLogTableName: "Audit Log",

  // Items fields
  itemNameField: "Item Name",

  // Count Sessions fields
  sessionDateField: "Session Date",
  sessionStatusField: "Status",
  sessionCountedByField: "Counted By",
  sessionStockCountsField: "Stock Counts",
  sessionNotesField: "Notes",

  // Stock Counts fields
  countItemField: "Item",
  countLocationField: "Location",
  countSessionField: "Count Session",
  countQuantityField: "Quantity",
  countPreviousField: "Previous Count",
  countNeedsReviewField: "Needs Review",
  countNotesField: "Notes",

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
  outlierHighMultiplier: 3.0,   // Flag if count > 3x previous
  outlierLowMultiplier: 0.2,    // Flag if count < 0.2x previous (80% drop)
  maxIssuesToShow: 30,
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

const batchUpdate_ = async (table, updates) => {
  for (let i = 0; i < updates.length; i += CONFIG.batchSize) {
    const chunk = updates.slice(i, i + CONFIG.batchSize);
    await table.updateRecordsAsync(chunk);
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
  console.log("WARATAH - VALIDATE STOCK COUNT");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Session ID: ${sessionIdInput || "(auto-detect)"}`);
  console.log("");

  // ── Phase 1: Load tables ──
  console.log("Phase 1: Loading tables...");

  const itemsTable = base.getTable(CONFIG.itemsTableName);
  const sessionsTable = base.getTable(CONFIG.countSessionsTableName);
  const countsTable = base.getTable(CONFIG.stockCountsTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  console.log("  OK");
  console.log("");

  // ── Phase 2: Find target session ──
  console.log("Phase 2: Finding target session...");

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
    // Auto-detect: find most recent Completed session (Evan marked it done after counting)
    const candidates = sessionsQuery.records.filter(r => {
      const status = r.getCellValue(CONFIG.sessionStatusField);
      return status?.name === "Completed";
    });

    if (candidates.length === 0) {
      throw new Error("No session with status 'Completed' found. Mark the Count Session as Completed after counting.");
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
  console.log("");

  // ── Phase 3: Fetch linked Stock Counts ──
  console.log("Phase 3: Fetching stock counts...");

  const linkedCountRefs = targetSession.getCellValue(CONFIG.sessionStockCountsField);
  if (!linkedCountRefs || linkedCountRefs.length === 0) {
    throw new Error("Session has no linked Stock Count records. Run Init Stock Count first.");
  }

  const linkedIds = new Set(linkedCountRefs.map(l => l.id));

  const countsQuery = await countsTable.selectRecordsAsync({
    fields: [
      CONFIG.countItemField,
      CONFIG.countLocationField,
      CONFIG.countQuantityField,
      CONFIG.countPreviousField,
      CONFIG.countNeedsReviewField,
      CONFIG.countNotesField,
    ],
  });

  const sessionCounts = countsQuery.records.filter(r => linkedIds.has(r.id));
  console.log(`  Found ${sessionCounts.length} stock count records`);
  console.log("");

  // Build item name lookup
  const itemsQuery = await itemsTable.selectRecordsAsync({
    fields: [CONFIG.itemNameField],
  });
  const itemNameMap = new Map();
  for (const item of itemsQuery.records) {
    itemNameMap.set(item.id, item.getCellValue(CONFIG.itemNameField) || "(Unknown)");
  }

  // ── Phase 4: Validate counts ──
  console.log("Phase 4: Validating counts...");

  const autoFilledZero = [];  // Records with null quantity → auto-filled to 0
  const outliers = [];        // Records with suspicious counts
  const negativeQty = [];     // Records with negative quantities
  let validCount = 0;

  for (const rec of sessionCounts) {
    let qty = rec.getCellValue(CONFIG.countQuantityField);
    const prevQty = rec.getCellValue(CONFIG.countPreviousField);
    const itemRef = rec.getCellValue(CONFIG.countItemField);
    const locRef = rec.getCellValue(CONFIG.countLocationField);
    const itemName = itemRef && itemRef[0] ? itemNameMap.get(itemRef[0].id) || "(Unknown)" : "(No item)";
    const locName = locRef && locRef[0] ? locRef[0].name || "(Unknown)" : "(No location)";

    if (qty == null) {
      // Treat blank as 0 — item not in stock at this location
      qty = 0;
      autoFilledZero.push({ id: rec.id, itemName, locName });
    }

    if (qty < 0) {
      negativeQty.push({ id: rec.id, itemName, locName, qty });
      continue;
    }

    // Outlier detection (only if previous count exists and is > 0)
    if (prevQty != null && prevQty > 0) {
      if (qty === 0) {
        outliers.push({
          id: rec.id, itemName, locName, qty, prevQty,
          reason: `0 count vs previous ${prevQty} — complete depletion`,
        });
      } else {
        const ratio = qty / prevQty;
        if (ratio > CONFIG.outlierHighMultiplier) {
          outliers.push({
            id: rec.id, itemName, locName, qty, prevQty,
            reason: `${qty} is ${ratio.toFixed(1)}x previous (${prevQty})`,
          });
        } else if (ratio < CONFIG.outlierLowMultiplier) {
          outliers.push({
            id: rec.id, itemName, locName, qty, prevQty,
            reason: `${qty} is ${(ratio * 100).toFixed(0)}% of previous (${prevQty}) — large drop`,
          });
        }
      }
    }

    validCount++;
  }

  console.log(`  Valid: ${validCount}`);
  console.log(`  Auto-filled to 0: ${autoFilledZero.length}`);
  console.log(`  Negative quantity: ${negativeQty.length}`);
  console.log(`  Outliers flagged: ${outliers.length}`);

  if (autoFilledZero.length > 0) {
    console.log("");
    console.log("  Auto-filled blanks → 0:");
    for (const m of autoFilledZero.slice(0, CONFIG.maxIssuesToShow)) {
      console.log(`    - ${m.itemName} @ ${m.locName}`);
    }
    if (autoFilledZero.length > CONFIG.maxIssuesToShow) {
      console.log(`    ... and ${autoFilledZero.length - CONFIG.maxIssuesToShow} more`);
    }
  }

  if (negativeQty.length > 0) {
    console.log("");
    console.log("  Negative quantities:");
    for (const n of negativeQty.slice(0, 10)) {
      console.log(`    - ${n.itemName} @ ${n.locName}: ${n.qty}`);
    }
  }

  if (outliers.length > 0) {
    console.log("");
    console.log("  Outliers:");
    for (const o of outliers.slice(0, CONFIG.maxIssuesToShow)) {
      console.log(`    - ${o.itemName} @ ${o.locName}: ${o.reason}`);
    }
    if (outliers.length > CONFIG.maxIssuesToShow) {
      console.log(`    ... and ${outliers.length - CONFIG.maxIssuesToShow} more`);
    }
  }
  console.log("");

  // ── Phase 4b: Auto-fill null quantities to 0 ──
  if (autoFilledZero.length > 0 && !dryRun) {
    const zeroUpdates = autoFilledZero.map(r => ({
      id: r.id,
      fields: { [CONFIG.countQuantityField]: 0 },
    }));
    await batchUpdate_(countsTable, zeroUpdates);
    console.log(`  Wrote 0 to ${zeroUpdates.length} blank records`);
  }
  console.log("");

  // ── Phase 5: Flag records needing review ──
  console.log("Phase 5: Flagging records for review...");

  const needsReviewIds = new Set([
    ...negativeQty.map(n => n.id),
    ...outliers.map(o => o.id),
  ]);

  const countUpdates = [];
  for (const rec of sessionCounts) {
    const shouldFlag = needsReviewIds.has(rec.id);
    const currentFlag = rec.getCellValue(CONFIG.countNeedsReviewField) === true;

    if (shouldFlag !== currentFlag) {
      countUpdates.push({
        id: rec.id,
        fields: { [CONFIG.countNeedsReviewField]: shouldFlag },
      });
    }
  }

  if (countUpdates.length > 0 && !dryRun) {
    await batchUpdate_(countsTable, countUpdates);
    console.log(`  Updated ${countUpdates.length} Needs Review flags`);
  } else if (countUpdates.length > 0) {
    console.log(`  [DRY RUN] Would update ${countUpdates.length} Needs Review flags`);
  } else {
    console.log("  No flag changes needed");
  }
  console.log("");

  // ── Phase 6: Determine result status ──
  console.log("Phase 6: Determining validation result...");

  const hasBlockers = negativeQty.length > 0;
  const hasOutliers = outliers.length > 0;

  let newStatus;
  let auditStatus;

  if (hasBlockers) {
    newStatus = "Needs Review";
    auditStatus = "WARNING";
    console.log("  Result: NEEDS REVIEW (negative quantities found)");
  } else if (hasOutliers) {
    newStatus = "Needs Review";
    auditStatus = "WARNING";
    console.log(`  Result: NEEDS REVIEW (${outliers.length} outliers flagged)`);
  } else {
    newStatus = "Validated";
    auditStatus = "SUCCESS";
    console.log("  Result: VALIDATED — all counts look good");
  }
  console.log("");

  // ── Phase 7: Update session status ──
  console.log("Phase 7: Updating session status...");

  if (!dryRun) {
    const sessionUpdateFields = {};
    const sField = safeField_(sessionsTable, CONFIG.sessionStatusField);
    if (sField && sField.type === "singleSelect") {
      sessionUpdateFields[CONFIG.sessionStatusField] = { name: newStatus };
    }

    // Add validation notes
    const notesField = safeField_(sessionsTable, CONFIG.sessionNotesField);
    if (notesField) {
      const noteLines = [
        `Validated: ${formatSydneyTimestamp_(new Date())}`,
        `Valid: ${validCount}, Auto-filled: ${autoFilledZero.length}, Negative: ${negativeQty.length}, Outliers: ${outliers.length}`,
      ];
      if (outliers.length > 0) {
        noteLines.push("");
        noteLines.push("Outliers:");
        for (const o of outliers.slice(0, 10)) {
          noteLines.push(`  - ${o.itemName}: ${o.reason}`);
        }
      }
      sessionUpdateFields[CONFIG.sessionNotesField] = noteLines.join("\n");
    }

    await sessionsTable.updateRecordAsync(targetSession.id, sessionUpdateFields);
    console.log(`  Session status -> "${newStatus}"`);
  } else {
    console.log(`  [DRY RUN] Would set status to "${newStatus}"`);
  }
  console.log("");

  // ── Phase 8: Summary ──
  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log("========================================");
  console.log("VALIDATE STOCK COUNT - COMPLETE");
  console.log("========================================");
  console.log(`Session: ${sessionDate}`);
  console.log(`Result: ${newStatus}`);
  console.log(`Total Records: ${sessionCounts.length}`);
  console.log(`Valid: ${validCount}`);
  console.log(`Auto-filled (blank→0): ${autoFilledZero.length}`);
  console.log(`Negative: ${negativeQty.length}`);
  console.log(`Outliers: ${outliers.length}`);
  console.log(`Execution Time: ${executionTime}s`);
  console.log("");

  // ── Phase 9: Audit Log ──
  if (!dryRun && auditLogTable) {
    await writeAuditLog_(auditLogTable, {
      scriptName: CONFIG.scriptName,
      status: auditStatus,
      message: `Validation ${newStatus}: ${validCount} valid, ${autoFilledZero.length} auto-filled to 0, ${outliers.length} outliers`,
      details: [
        `Session Date: ${sessionDate}`,
        `Result: ${newStatus}`,
        `Total: ${sessionCounts.length}`,
        `Valid: ${validCount}`,
        `Auto-filled (blank→0): ${autoFilledZero.length}`,
        `Negative: ${negativeQty.length}`,
        `Outliers: ${outliers.length}`,
        `Flags Updated: ${countUpdates.length}`,
      ].join("\n"),
      user: countedBy?.name || "(Unknown)",
      executionTime: parseFloat(executionTime),
      configUsed: JSON.stringify({ dryRun, sessionIdInput }, null, 2),
    });
  }

  // Output for Airtable interface
  output.set("status", newStatus.toLowerCase().replace(/ /g, "_"));
  output.set("validCount", validCount);
  output.set("autoFilledCount", autoFilledZero.length);
  output.set("outlierCount", outliers.length);
  output.set("negativeCount", negativeQty.length);
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
    console.log("VALIDATE STOCK COUNT - FAILED");
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
