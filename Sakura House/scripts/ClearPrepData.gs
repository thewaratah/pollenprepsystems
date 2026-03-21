/****************************************************
 * CLEAR PREP DATA — FRIDAY MORNING CLEANUP
 *
 * VERSION: 1.0
 *
 * Purpose:
 *   Deletes all Prep Tasks and Ingredient Requirements
 *   to prevent data accumulation. Run each Friday before
 *   the weekend stocktake cycle begins.
 *
 * Automation inputs (optional):
 *   - dryRun: boolean (default: false)
 *
 * Schedule: Friday AM (Airtable automation, scheduled trigger)
 ****************************************************/

const INPUT = (typeof input !== "undefined" && input?.config) ? input.config() : {};
const dryRun = INPUT.dryRun === true;

const CONFIG = {
  timeZone: "Australia/Sydney",

  // Tables
  tasksTableName: "Prep Tasks",
  reqTableName: "Ingredient Requirements",
  auditLogTableName: "Audit Log",

  // Audit Log fields
  auditTimestampField: "Timestamp",
  auditScriptNameField: "Script Name",
  auditStatusField: "Status",
  auditMessageField: "Message",
  auditDetailsField: "Details",
  auditExecutionTimeField: "Execution Time (seconds)",
  auditConfigUsedField: "Config Used",

  // Limits
  batchSize: 50,

  // Script identifier
  scriptName: "CLEAR PREP DATA",
};

function formatSydneyTimestamp_(date) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+):(\d+)/, "$3-$2-$1 $4:$5:$6");
}

function safeGetTable_(name) {
  try {
    return base.getTable(name);
  } catch (e) {
    return null;
  }
}

async function batchDelete_(table, recordIds) {
  let deleted = 0;
  let skipped = 0;
  for (let i = 0; i < recordIds.length; i += CONFIG.batchSize) {
    const chunk = recordIds.slice(i, i + CONFIG.batchSize);
    try {
      await table.deleteRecordsAsync(chunk);
      deleted += chunk.length;
    } catch (e) {
      // Fallback: delete one-by-one to skip already-deleted records
      for (const id of chunk) {
        try {
          await table.deleteRecordsAsync([id]);
          deleted++;
        } catch (e2) {
          skipped++;
        }
      }
    }
  }
  return { deleted, skipped };
}

async function writeAuditLog_(auditLogTable, logEntry) {
  if (!auditLogTable) return;

  const fields = {};

  fields[CONFIG.auditTimestampField] = new Date();

  try {
    const scriptField = auditLogTable.getField(CONFIG.auditScriptNameField);
    if (scriptField.type === "singleSelect") {
      fields[CONFIG.auditScriptNameField] = { name: logEntry.scriptName };
    } else {
      fields[CONFIG.auditScriptNameField] = logEntry.scriptName;
    }
  } catch (e) {
    // Field missing — skip
    return;
  }

  try {
    const statusField = auditLogTable.getField(CONFIG.auditStatusField);
    if (statusField.type === "singleSelect") {
      fields[CONFIG.auditStatusField] = { name: logEntry.status };
    } else {
      fields[CONFIG.auditStatusField] = logEntry.status;
    }
  } catch (e) {
    return;
  }

  if (logEntry.message) fields[CONFIG.auditMessageField] = logEntry.message;
  if (logEntry.details) fields[CONFIG.auditDetailsField] = logEntry.details;
  if (logEntry.executionTime != null) fields[CONFIG.auditExecutionTimeField] = logEntry.executionTime;
  if (logEntry.configUsed) fields[CONFIG.auditConfigUsedField] = logEntry.configUsed;

  await auditLogTable.createRecordAsync(fields);
}

async function main() {
  const startTime = Date.now();

  console.log("========================================");
  console.log("CLEAR PREP DATA - Starting");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  const tasksTable = base.getTable(CONFIG.tasksTableName);
  const reqTable = base.getTable(CONFIG.reqTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  // PHASE 1: Delete all Prep Tasks
  console.log("Phase 1: Clearing Prep Tasks...");
  const tasksQuery = await tasksTable.selectRecordsAsync({ fields: [] });
  const taskIds = tasksQuery.records.map(r => r.id);
  console.log(`  → Found ${taskIds.length} records`);

  let tasksResult = { deleted: 0, skipped: 0 };
  if (!dryRun && taskIds.length > 0) {
    tasksResult = await batchDelete_(tasksTable, taskIds);
    console.log(`  ✓ Deleted ${tasksResult.deleted}${tasksResult.skipped ? `, skipped ${tasksResult.skipped} (already deleted)` : ""}`);
  } else if (dryRun && taskIds.length > 0) {
    console.log("  → [DRY RUN] Would delete");
  }

  // PHASE 2: Delete all Ingredient Requirements
  console.log("");
  console.log("Phase 2: Clearing Ingredient Requirements...");
  const reqQuery = await reqTable.selectRecordsAsync({ fields: [] });
  const reqIds = reqQuery.records.map(r => r.id);
  console.log(`  → Found ${reqIds.length} records`);

  let reqsResult = { deleted: 0, skipped: 0 };
  if (!dryRun && reqIds.length > 0) {
    reqsResult = await batchDelete_(reqTable, reqIds);
    console.log(`  ✓ Deleted ${reqsResult.deleted}${reqsResult.skipped ? `, skipped ${reqsResult.skipped} (already deleted)` : ""}`);
  } else if (dryRun && reqIds.length > 0) {
    console.log("  → [DRY RUN] Would delete");
  }

  // PHASE 3: Summary + Audit Log
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("");
  console.log("========================================");
  console.log("✓ CLEAR PREP DATA - Complete");
  console.log("========================================");
  console.log(`Prep Tasks deleted: ${taskIds.length}`);
  console.log(`Ingredient Requirements deleted: ${reqIds.length}`);
  console.log(`Execution time: ${executionTime}s`);

  const message = dryRun
    ? `[DRY RUN] Would delete ${taskIds.length} tasks, ${reqIds.length} requirements`
    : `Deleted ${taskIds.length} tasks, ${reqIds.length} requirements`;

  await writeAuditLog_(auditLogTable, {
    scriptName: CONFIG.scriptName,
    status: "SUCCESS",
    message,
    details: `Prep Tasks: ${taskIds.length}\nIngredient Requirements: ${reqIds.length}\nMode: ${dryRun ? "DRY RUN" : "LIVE"}`,
    executionTime: parseFloat(executionTime),
    configUsed: JSON.stringify({ dryRun }, null, 2),
  });
}

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
    console.log("❌ CLEAR PREP DATA - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);

    if (!dryRun && auditLogTable) {
      try {
        await writeAuditLog_(auditLogTable, {
          scriptName: CONFIG.scriptName,
          status: "ERROR",
          message: `Script failed: ${errorMessage}`,
          executionTime: parseFloat(executionTime),
          configUsed: JSON.stringify({ dryRun }, null, 2),
        });
      } catch (logErr) {
        console.log(`⚠️ Could not write error to Audit Log: ${logErr.message}`);
      }
    }

    throw err;
  }
})();
