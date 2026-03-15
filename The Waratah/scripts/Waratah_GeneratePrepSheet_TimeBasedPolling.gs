/****************************************************
 * THE WARATAH - EXPORT REQUEST MARKER — TIME-BASED POLLING VERSION
 *
 * VERSION: 4.0 (time-based trigger compatible)
 *
 * VENUE: The Waratah
 * TRIGGER: Sunday 11:15pm (time-based)
 *
 * Purpose:
 *   Finds all Prep Runs that need export and marks them as REQUESTED.
 *   Google Apps Script time-trigger polls and processes requests.
 *
 * TRIGGER SETUP:
 *   At a scheduled time:
 *     - Day: Sunday
 *     - Time: 11:15 PM
 *     - Timezone: Australia/Sydney
 *
 * NO INPUTS REQUIRED - Script queries the table automatically
 ****************************************************/

const CONFIG = {
  timeZone: "Australia/Sydney",

  // Prep Runs fields
  exportRequestStateField: "Export Request State",
  exportRequestedAtField: "Export Requested At",
  exportLastErrorField: "Export Last Error",
  exportModeField: "Export Mode",
  exportNotifySlackField: "Export Notify Slack",
  prepWeekField: "Prep Week",

  // Status values
  requestedStatus: "REQUESTED",

  // How to identify prep runs needing export
  // Option 1: Export Request State is empty or null
  // Option 2: Export Request State = "READY" (if you use this status)
  readyToExportStatuses: [null, "", "READY"],

  // Date guard: only process Prep Runs whose Prep Week date is within this
  // many days in the past. Prevents stale historical runs from being
  // re-triggered by the polling script.
  maxAgeDays: 14,

  // Batch processing limit
  maxRecordsToProcess: 10,
};

/** Helper: Format Sydney timestamp */
const formatSydneyTimestamp_ = (date) => {
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
};

const safeField_ = (table, fieldName) => {
  try {
    return table.getField(fieldName);
  } catch {
    return null;
  }
};

/** Main function */
const main = async () => {
  const startTime = Date.now();

  console.log("========================================");
  console.log("EXPORT REQUEST MARKER - Starting");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: TIME-BASED POLLING`);
  console.log("");

  const table = base.getTable("Prep Runs");

  // Query all prep runs
  const query = await table.selectRecordsAsync({
    fields: [
      CONFIG.exportRequestStateField,
      CONFIG.exportRequestedAtField,
      CONFIG.exportLastErrorField,
      CONFIG.prepWeekField,
    ]
  });

  console.log(`Total Prep Runs found: ${query.records.length}`);
  console.log("");

  // Date guard: calculate the earliest Prep Week date we will process.
  // Runs older than maxAgeDays are ignored to prevent historical runs from
  // being re-triggered by this polling script.
  const now = new Date();
  const cutoffMs = now.getTime() - (CONFIG.maxAgeDays * 24 * 60 * 60 * 1000);
  console.log(`Date guard: only processing runs with Prep Week on or after ${new Date(cutoffMs).toISOString().slice(0, 10)} (last ${CONFIG.maxAgeDays} days)`);
  console.log("");

  // Find records that need export
  const recordsNeedingExport = [];

  for (const record of query.records) {
    const currentState = record.getCellValue(CONFIG.exportRequestStateField);
    const currentStateName = currentState?.name || null;

    // Check if this record needs export
    // (Export Request State is empty/null OR equals a "ready" status)
    const needsExport =
      currentStateName === null ||
      currentStateName === "" ||
      CONFIG.readyToExportStatuses.includes(currentStateName);

    // Skip if already REQUESTED or IN_PROGRESS
    const isAlreadyProcessing =
      currentStateName === "REQUESTED" ||
      currentStateName === "IN_PROGRESS";

    if (!needsExport || isAlreadyProcessing) continue;

    // Date guard: skip runs whose Prep Week is older than maxAgeDays
    const prepWeekValue = record.getCellValue(CONFIG.prepWeekField);
    if (prepWeekValue) {
      const prepWeekDate = new Date(prepWeekValue);
      if (Number.isFinite(prepWeekDate.getTime()) && prepWeekDate.getTime() < cutoffMs) {
        continue;
      }
    }

    recordsNeedingExport.push(record);
  }

  console.log(`Records needing export: ${recordsNeedingExport.length}`);

  if (recordsNeedingExport.length === 0) {
    console.log("✓ No prep runs need export at this time");
    console.log("");

    output.set("status", "no_work");
    output.set("recordsProcessed", 0);
    output.set("message", "No prep runs needed export");
    return;
  }

  // Limit to maxRecordsToProcess
  const recordsToProcess = recordsNeedingExport.slice(0, CONFIG.maxRecordsToProcess);

  if (recordsNeedingExport.length > CONFIG.maxRecordsToProcess) {
    console.log(`⚠️ Limiting to ${CONFIG.maxRecordsToProcess} records (${recordsNeedingExport.length} total)`);
  }

  console.log("");
  console.log(`Processing ${recordsToProcess.length} prep runs...`);
  console.log("");

  // Mark each record as REQUESTED
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const record of recordsToProcess) {
    try {
      const fields = {};

      // Set status to REQUESTED
      const stateField = safeField_(table, CONFIG.exportRequestStateField);
      if (stateField) {
        if (stateField.type === "singleSelect") {
          fields[CONFIG.exportRequestStateField] = { name: CONFIG.requestedStatus };
        } else {
          fields[CONFIG.exportRequestStateField] = CONFIG.requestedStatus;
        }
      }

      // Set requested timestamp
      const requestedField = safeField_(table, CONFIG.exportRequestedAtField);
      if (requestedField) {
        fields[CONFIG.exportRequestedAtField] = new Date();
      }

      // Clear any previous error
      const errorField = safeField_(table, CONFIG.exportLastErrorField);
      if (errorField) {
        fields[CONFIG.exportLastErrorField] = "";
      }

      // Update record
      await table.updateRecordAsync(record.id, fields);

      console.log(`  ✓ Marked ${record.id} as REQUESTED`);
      successCount++;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Failed to mark ${record.id}: ${errorMessage}`);
      errorCount++;
      errors.push({ recordId: record.id, error: errorMessage });
    }
  }

  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log("");
  console.log("========================================");
  console.log("✓ EXPORT REQUEST MARKER - Complete");
  console.log("========================================");
  console.log(`Execution time: ${executionTime}s`);
  console.log("");
  console.log(`✓ Successfully marked: ${successCount}`);
  if (errorCount > 0) {
    console.log(`❌ Failed to mark: ${errorCount}`);
  }
  console.log("");
  console.log("📋 Export Status: REQUESTED");
  console.log("");
  console.log("⏱️  Google Apps Script will process these requests");
  console.log("   within the next 5 minutes.");
  console.log("");

  // Output variables
  output.set("status", errorCount > 0 ? "partial_success" : "success");
  output.set("recordsProcessed", successCount);
  output.set("recordsFailed", errorCount);
  output.set("executionTime", executionTime);
  output.set("message", `Marked ${successCount} prep runs for export`);

  if (errors.length > 0) {
    output.set("errors", JSON.stringify(errors));
  }
};

// Execute with error handling
(async () => {
  try {
    await main();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.log("");
    console.log("========================================");
    console.log("❌ EXPORT REQUEST MARKER - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log("");

    throw err;
  }
})();
