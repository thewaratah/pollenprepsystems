/****************************************************
 * Waratah_ExportOrderingDoc.gs
 *
 * Airtable Automation Script — runs INSIDE Airtable (not GAS).
 * Marks the latest "Orders Generated" Count Session for ordering
 * doc export by setting its Ordering Export State to "REQUESTED".
 *
 * GoogleDocsPrepSystem.gs polls for this flag via a GAS time-trigger
 * and generates the Combined Ordering Run Sheet.
 *
 * TRIGGER: Button press in Count Sessions interface
 *
 * NO INPUTS REQUIRED — auto-detects the latest validated session.
 *
 * GUARD: Only marks sessions with status "Orders Generated".
 ****************************************************/

// ── CONFIG ─────────────────────────────────────────────────────────
const CONFIG = {
  timeZone: "Australia/Sydney",
  scriptName: "WARATAH - EXPORT ORDERING DOC",

  // Tables
  countSessionsTableName: "Count Sessions",
  auditLogTableName: "Audit Log",

  // Count Sessions fields
  sessionDateField: "Session Date",
  sessionStatusField: "Status",
  orderingExportStateField: "Ordering Export State",   // Single select: REQUESTED / COMPLETED / ERROR

  // Audit Log fields
  auditTimestampField: "Timestamp",
  auditScriptNameField: "Script Name",
  auditStatusField: "Status",
  auditMessageField: "Message",
  auditDetailsField: "Details",
  auditExecutionTimeField: "Execution Time (seconds)",

  // Export state values
  requestedState: "REQUESTED",
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
  if (!auditLogTable) return;

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
  if (logEntry.executionTime != null) {
    const execField = safeField_(auditLogTable, CONFIG.auditExecutionTimeField);
    if (execField && execField.type === "number") fields[CONFIG.auditExecutionTimeField] = logEntry.executionTime;
  }

  await auditLogTable.createRecordAsync(fields);
};

// ── MAIN ────────────────────────────────────────────────────────────

const main = async () => {
  const startTime = Date.now();

  console.log("========================================");
  console.log("WARATAH - EXPORT ORDERING DOC");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log("");

  // ── Phase 1: Find latest "Orders Generated" session ──
  console.log("Phase 1: Finding session with Orders Generated...");

  const sessionsTable = base.getTable(CONFIG.countSessionsTableName);

  // Verify the Ordering Export State field exists
  const exportStateField = safeField_(sessionsTable, CONFIG.orderingExportStateField);
  if (!exportStateField) {
    throw new Error(`Field "${CONFIG.orderingExportStateField}" not found on Count Sessions table. Add a Single Select field with options: REQUESTED, COMPLETED, ERROR.`);
  }

  const sessionsQuery = await sessionsTable.selectRecordsAsync({
    fields: [CONFIG.sessionDateField, CONFIG.sessionStatusField, CONFIG.orderingExportStateField],
  });

  const ordersGenerated = sessionsQuery.records.filter(r => {
    const status = r.getCellValue(CONFIG.sessionStatusField);
    return status?.name === "Orders Generated";
  });

  if (ordersGenerated.length === 0) {
    throw new Error('No Count Session with status "Orders Generated". Run the full stock count workflow first.');
  }

  // Sort by date descending to get latest
  ordersGenerated.sort((a, b) => {
    const da = a.getCellValue(CONFIG.sessionDateField) || "";
    const db = b.getCellValue(CONFIG.sessionDateField) || "";
    return db.localeCompare(da);
  });

  const session = ordersGenerated[0];
  const sessionDate = session.getCellValue(CONFIG.sessionDateField) || "(no date)";
  const currentExportState = session.getCellValue(CONFIG.orderingExportStateField);

  console.log(`  Session: ${sessionDate} (${session.id})`);
  console.log(`  Current export state: ${currentExportState?.name || "(empty)"}`);

  // Guard: don't re-request if already REQUESTED or COMPLETED
  if (currentExportState?.name === "REQUESTED") {
    console.log("  Already REQUESTED — waiting for GAS to process. No action taken.");
    output.set("status", "already_requested");
    output.set("message", "Export already requested — GAS will process it shortly.");
    return;
  }

  if (currentExportState?.name === "COMPLETED") {
    console.log("  Already COMPLETED. To regenerate, clear the Ordering Export State field first.");
    output.set("status", "already_completed");
    output.set("message", "Ordering doc already generated for this session.");
    return;
  }

  // ── Phase 2: Set Ordering Export State to REQUESTED ──
  console.log("");
  console.log("Phase 2: Marking session for ordering export...");

  await sessionsTable.updateRecordAsync(session.id, {
    [CONFIG.orderingExportStateField]: { name: CONFIG.requestedState },
  });

  console.log(`  Set Ordering Export State → "REQUESTED"`);
  console.log("  GAS will pick this up on next poll and generate the ordering doc.");
  console.log("");

  console.log("========================================");
  console.log("EXPORT ORDERING DOC - REQUESTED");
  console.log("========================================");
  console.log(`Session: ${sessionDate}`);
  console.log("The ordering doc will be generated within 1-2 minutes.");
  console.log("You'll receive a Slack notification when it's ready.");
  console.log("");

  output.set("status", "requested");
  output.set("message", `Ordering export requested for session ${sessionDate}. Doc will be generated within 1-2 minutes.`);

  // ── Audit Log ──
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);
  if (auditLogTable) {
    await writeAuditLog_(auditLogTable, {
      scriptName: CONFIG.scriptName,
      status: "SUCCESS",
      message: `Ordering export requested for session ${sessionDate}`,
      executionTime: parseFloat(executionTime),
    });
  }
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

    console.log("");
    console.log("========================================");
    console.log("EXPORT ORDERING DOC - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log("");

    if (auditLogTable) {
      try {
        await writeAuditLog_(auditLogTable, {
          scriptName: CONFIG.scriptName,
          status: "ERROR",
          message: `Script failed: ${errorMessage}`,
          executionTime: parseFloat(executionTime),
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
