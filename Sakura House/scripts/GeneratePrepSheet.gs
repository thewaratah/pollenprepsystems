/****************************************************
 * EXPORT REQUEST MARKER — AUTOMATION VERSION
 * 
 * VERSION: 3.1 (for Airtable Automation triggers)
 *
 * Purpose:
 *   Marks Prep Run for export by setting Export Request State.
 *   Google Apps Script time-trigger polls and processes requests.
 *
 * TRIGGER SETUP:
 *   When record matches conditions:
 *     - Table: Prep Runs
 *     - When: Record matches conditions
 *     - Condition: [Any field updates] or [Button field clicked]
 *
 * ACTION SETUP:
 *   Run script:
 *     - Record ID: Use "Record ID" from trigger
 ****************************************************/

const CONFIG = {
  timeZone: "Australia/Sydney",

  // Prep Runs fields
  exportRequestStateField: "Export Request State",
  exportRequestedAtField: "Export Requested At",
  exportLastErrorField: "Export Last Error",
  exportModeField: "Export Mode",
  exportNotifySlackField: "Export Notify Slack",

  // Status values
  requestedStatus: "REQUESTED",
};

/** Helper: Format Sydney timestamp */
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

function safeField_(table, fieldName) {
  try {
    return table.getField(fieldName);
  } catch {
    return null;
  }
}

/** Main function */
async function main() {
  const startTime = Date.now();

  console.log("========================================");
  console.log("EXPORT REQUEST MARKER - Starting");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log("");

  const table = base.getTable("Prep Runs");
  
  // Get record ID from automation input
  const inputConfig = input.config();
  const recordId = inputConfig.recordId;
  
  if (!recordId) {
    throw new Error(
      "No record ID provided.\n\n" +
      "Setup:\n" +
      "1. Automation Trigger: When record matches conditions\n" +
      "2. Action: Run script\n" +
      "3. In script action: Add input 'recordId' = {Record ID from trigger}"
    );
  }

  console.log(`Processing Prep Run: ${recordId}`);
  
  // Load the record
  const record = await table.selectRecordAsync(recordId, {
    fields: [
      CONFIG.exportRequestStateField,
      CONFIG.exportRequestedAtField,
      CONFIG.exportLastErrorField,
    ]
  });

  if (!record) {
    throw new Error(`Record ${recordId} not found in Prep Runs table`);
  }

  console.log("");

  // Check if already requested/processing
  const currentState = record.getCellValue(CONFIG.exportRequestStateField);
  const currentStateName = currentState?.name || "";

  if (currentStateName === "REQUESTED" || currentStateName === "IN_PROGRESS") {
    console.log(`⚠️ Export already ${currentStateName.toLowerCase()}`);
    console.log(`Current status: ${currentStateName}`);
    console.log("");
    console.log("Please wait for current export to complete.");
    console.log("Check back in a few minutes or refresh the record.");
    return;
  }

  // Build update fields
  const fields = {};

  // Set status to REQUESTED
  const stateField = safeField_(table, CONFIG.exportRequestStateField);
  if (stateField) {
    if (stateField.type === "singleSelect") {
      fields[CONFIG.exportRequestStateField] = { name: CONFIG.requestedStatus };
    } else {
      fields[CONFIG.exportRequestStateField] = CONFIG.requestedStatus;
    }
  } else {
    throw new Error(`Missing required field: "${CONFIG.exportRequestStateField}"`);
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
  await table.updateRecordAsync(recordId, fields);

  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log("========================================");
  console.log("✓ EXPORT REQUEST MARKER - Complete");
  console.log("========================================");
  console.log(`Execution time: ${executionTime}s`);
  console.log("");
  console.log("📋 Export Status: REQUESTED");
  console.log("");
  console.log("⏱️  Google Apps Script will process this request");
  console.log("   within the next 5 minutes.");
  console.log("");
  console.log("💡 To check status:");
  console.log("   1. Refresh this record");
  console.log("   2. Check 'Export Request State' field");
  console.log("   3. When DONE, find docs in 'Link to Prep Guides'");
  console.log("");

  // Output variables
  output.set("status", "requested");
  output.set("recordId", recordId);
  output.set("executionTime", executionTime);
  output.set("message", "Export request submitted. Processing will begin within 5 minutes.");
}

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