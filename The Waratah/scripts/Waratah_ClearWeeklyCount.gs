/****************************************************
 * THE WARATAH - WEEKLY COUNTS — SATURDAY PLACEHOLDER GENERATOR (HARD CLEAR ALL)
 *
 * VERSION: 2.0 (with audit logging + progress indicators)
 *
 * VENUE: The Waratah
 * TRIGGER: Monday 3pm
 *
 * Purpose:
 *   Resets Weekly Counts table to prepare for new stocktake.
 *   Optionally preserves previous verified stocktakes.
 *
 * Automation inputs (optional):
 *   - includeInactive: boolean (default: false)
 *   - dryRun: boolean (default: false)
 *   - preserveVerifiedStocktakes: boolean (default: false)
 *
 * CHANGES IN v2.0:
 *   - Adds audit logging to "Audit Log" table
 *   - Enhanced progress indicators via console.log
 *   - Captures user from Last Modified By field
 *   - Detailed execution metrics
 ****************************************************/

const INPUT = (typeof input !== "undefined" && input?.config) ? input.config() : {};
const includeInactive = INPUT.includeInactive === true;
const dryRun = INPUT.dryRun === true;
const preserveVerifiedStocktakes = INPUT.preserveVerifiedStocktakes === false
  ? false
  : (INPUT.preserveVerifiedStocktakes === true);
// When true: skip deletion, only add placeholders for items not already in Weekly Counts.
// Use this for mid-week manual runs to add new items without wiping existing count data.
const addMissingOnly = INPUT.addMissingOnly === true;

const CONFIG = {
  timeZone: "Australia/Sydney",

  // Tables
  itemsTableName: "Items",
  countsTableName: "Weekly Counts",
  auditLogTableName: "Audit Log",

  // Items fields
  itemTypeField: "Item Type",
  itemActiveField: "Active",

  // Weekly Counts fields
  countItemLinkField: "Item",
  countQtyField: "Stock Count",
  countDateField: "Count Date",
  countSourceField: "Count Source",
  countConfirmedField: "Confirmed",

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

  // Staff auto-fill
  countStaffField: "Staff",
  countStaffDefaultValue: "Blade",

  // Behaviour
  allowedItemTypes: ["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"],
  placeholderSourceName: "Generated / Placeholder",
  verifiedSourceName: "Stocktake (Verified)",
  preserveVerifiedStocktakesDefault: false,

  // Limits
  batchSize: 50,

  // Script identifier for audit log
  scriptName: "WARATAH - CLEAR WEEKLY COUNT",
};

/** Helper: Get current Sydney timestamp */
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

/** Helper: Safely get table */
const safeGetTable_ = (name) => {
  try {
    return base.getTable(name);
  } catch (e) {
    return null;
  }
};

/** Helper: Safely get field */
const safeField_ = (table, fieldName) => {
  try {
    return table.getField(fieldName);
  } catch (e) {
    return null;
  }
};

/** Helper: Batch delete records */
const batchDelete_ = async (table, recordIds) => {
  const chunks = [];
  for (let i = 0; i < recordIds.length; i += CONFIG.batchSize) {
    chunks.push(recordIds.slice(i, i + CONFIG.batchSize));
  }

  for (const chunk of chunks) {
    await table.deleteRecordsAsync(chunk);
  }
};

/** Helper: Batch create records */
const batchCreate_ = async (table, records) => {
  const chunks = [];
  for (let i = 0; i < records.length; i += CONFIG.batchSize) {
    chunks.push(records.slice(i, i + CONFIG.batchSize));
  }

  for (const chunk of chunks) {
    await table.createRecordsAsync(chunk);
  }
};

/** Helper: Get user from recently modified records */
const getUserFromModifiedRecords_ = async (table, sampleSize = 3) => {
  try {
    // Query recent records (by createdTime descending)
    const query = await table.selectRecordsAsync({
      sorts: [{ field: table.primaryField, direction: "desc" }],
    });

    if (!query.records.length) return "(Unknown)";

    // Try to find Last Modified By from most recent records
    // Note: This requires the table to have a "Last Modified By" field
    // If it doesn't exist, this will gracefully fall back to "(Unknown)"
    
    const recentRecords = query.records.slice(0, sampleSize);
    
    for (const record of recentRecords) {
      // Airtable's Last Modified By field returns collaborator object
      // Try common field names
      const fieldNames = [
        "Last Modified By",
        "Modified By", 
        "Created By",
        "Last Modified By (from Weekly Counts)" // If linked
      ];

      for (const fieldName of fieldNames) {
        try {
          const field = table.getField(fieldName);
          const value = record.getCellValue(field);
          
          if (value && value.name) {
            return value.name;
          }
          if (value && value.email) {
            return value.email;
          }
        } catch (e) {
          // Field doesn't exist, continue
          continue;
        }
      }
    }

    return "(Unknown - no Last Modified By field found)";
  } catch (e) {
    console.log(`⚠️ Could not determine user: ${e.message}`);
    return "(Unknown)";
  }
};

/** Main audit logging function */
const writeAuditLog_ = async (auditLogTable, logEntry) => {
  if (!auditLogTable) {
    throw new Error("Audit Log table not found. Please create it before running this script.");
  }

  const fields = {};

  // Timestamp (required)
  const timestampField = safeField_(auditLogTable, CONFIG.auditTimestampField);
  if (timestampField) {
    fields[CONFIG.auditTimestampField] = new Date();
  }

  // Script Name (required, single select)
  try {
    const scriptField = auditLogTable.getField(CONFIG.auditScriptNameField);
    const scriptName = logEntry.scriptName || CONFIG.scriptName;

    if (scriptField.type === "singleSelect") {
      // Check if the option exists in the single select
      const options = scriptField.options.choices.map(choice => choice.name);
      if (options.includes(scriptName)) {
        fields[CONFIG.auditScriptNameField] = { name: scriptName };
      } else {
        // Option doesn't exist - use a fallback or skip
        console.log(`⚠️ Warning: Script name "${scriptName}" not found in Audit Log single select options`);
        console.log(`   Available options: ${options.join(", ")}`);
        console.log(`   Please add "${scriptName}" to the Script Name field options in Airtable`);
        // Use first available option as fallback
        if (options.length > 0) {
          fields[CONFIG.auditScriptNameField] = { name: options[0] };
          console.log(`   Using fallback: "${options[0]}"`);
        }
      }
    } else {
      fields[CONFIG.auditScriptNameField] = scriptName;
    }
  } catch (e) {
    // Field missing
    throw new Error(`Audit Log table missing required field: ${CONFIG.auditScriptNameField}`);
  }

  // Status (required, single select)
  try {
    const statusField = auditLogTable.getField(CONFIG.auditStatusField);
    if (statusField.type === "singleSelect") {
      fields[CONFIG.auditStatusField] = { name: logEntry.status };
    } else {
      fields[CONFIG.auditStatusField] = logEntry.status;
    }
  } catch (e) {
    throw new Error(`Audit Log table missing required field: ${CONFIG.auditStatusField}`);
  }

  // Message (required)
  if (logEntry.message) {
    fields[CONFIG.auditMessageField] = logEntry.message;
  }

  // Optional fields
  if (logEntry.details) {
    fields[CONFIG.auditDetailsField] = logEntry.details;
  }

  if (logEntry.user) {
    const userField = safeField_(auditLogTable, CONFIG.auditUserField);
    if (userField) {
      if (userField.type === "singleSelect") {
        fields[CONFIG.auditUserField] = { name: String(logEntry.user).substring(0, 100) };
      } else {
        fields[CONFIG.auditUserField] = logEntry.user;
      }
    }
  }

  if (logEntry.executionTime != null) {
    const execField = safeField_(auditLogTable, CONFIG.auditExecutionTimeField);
    if (execField && execField.type === "number") {
      fields[CONFIG.auditExecutionTimeField] = logEntry.executionTime;
    }
  }

  if (logEntry.errorStack) {
    const stackField = safeField_(auditLogTable, CONFIG.auditErrorStackField);
    if (stackField) {
      fields[CONFIG.auditErrorStackField] = logEntry.errorStack;
    }
  }

  if (logEntry.configUsed) {
    const configField = safeField_(auditLogTable, CONFIG.auditConfigUsedField);
    if (configField) {
      fields[CONFIG.auditConfigUsedField] = logEntry.configUsed;
    }
  }

  await auditLogTable.createRecordAsync(fields);
};

/** Main function */
const main = async () => {
  const startTime = Date.now();

  console.log("========================================");
  console.log("CLEAR WEEKLY COUNT - Starting");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Add Missing Only: ${addMissingOnly}`);
  console.log(`Include Inactive: ${includeInactive}`);
  console.log(`Preserve Verified: ${preserveVerifiedStocktakes}`);
  console.log("");

  const itemsTable = base.getTable(CONFIG.itemsTableName);
  const countsTable = base.getTable(CONFIG.countsTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  // PHASE 1: Scan existing counts — delete or build skip-set depending on mode
  console.log("Phase 1: Scanning Weekly Counts...");
  const countsQuery = await countsTable.selectRecordsAsync({
    fields: [CONFIG.countConfirmedField, CONFIG.countSourceField, CONFIG.countItemLinkField],
  });

  let toDelete = [];
  let preservedCount = 0;
  // Item IDs that already have a count record this week (used in addMissingOnly mode)
  const existingItemIds = new Set();

  if (addMissingOnly) {
    // Don't delete anything — collect item IDs already tracked so we skip them in Phase 3
    console.log("  → Add-missing-only mode: preserving all existing records");
    for (const rec of countsQuery.records) {
      const itemLink = rec.getCellValue(CONFIG.countItemLinkField);
      if (itemLink && Array.isArray(itemLink) && itemLink[0]?.id) {
        existingItemIds.add(itemLink[0].id);
      }
    }
    console.log(`  → Found ${countsQuery.records.length} existing records (${existingItemIds.size} unique items)`);
  } else if (preserveVerifiedStocktakes) {
    console.log("  → Preserve mode: keeping verified stocktakes");
    for (const rec of countsQuery.records) {
      const isConfirmed = rec.getCellValue(CONFIG.countConfirmedField) === true;
      const source = rec.getCellValue(CONFIG.countSourceField);
      const isVerified = source && source.name === CONFIG.verifiedSourceName;

      if (isConfirmed && isVerified) {
        preservedCount++;
      } else {
        toDelete.push(rec.id);
      }
    }
    console.log(`  → Found ${countsQuery.records.length} existing records`);
    console.log(`  → Preserving ${preservedCount} verified stocktakes`);
    console.log(`  → Deleting ${toDelete.length} records`);
  } else {
    console.log("  → Delete all mode");
    toDelete = countsQuery.records.map(r => r.id);
    console.log(`  → Found ${countsQuery.records.length} existing records`);
    console.log(`  → Deleting ${toDelete.length} records`);
  }

  if (!dryRun && toDelete.length > 0) {
    console.log("  → Executing deletes...");
    await batchDelete_(countsTable, toDelete);
    console.log("  ✓ Deletes complete");
  } else if (dryRun && toDelete.length > 0) {
    console.log("  → [DRY RUN] Would delete records");
  }

  // PHASE 2: Query items for placeholders
  console.log("");
  console.log("Phase 2: Querying Items table...");
  
  const itemsQuery = await itemsTable.selectRecordsAsync({
    fields: [CONFIG.itemTypeField, CONFIG.itemActiveField],
  });

  const itemTypeCounts = {};
  const matchedItems = [];

  for (const rec of itemsQuery.records) {
    const itemType = rec.getCellValue(CONFIG.itemTypeField)?.name;
    const isActive = rec.getCellValue(CONFIG.itemActiveField) === true;

    if (!CONFIG.allowedItemTypes.includes(itemType)) continue;
    if (!includeInactive && !isActive) continue;

    matchedItems.push(rec.id);
    itemTypeCounts[itemType] = (itemTypeCounts[itemType] || 0) + 1;
  }

  console.log(`  → Matched ${matchedItems.length} items:`);
  for (const [type, count] of Object.entries(itemTypeCounts)) {
    console.log(`     - ${type}: ${count}`);
  }

  // PHASE 3: Create placeholders
  console.log("");
  console.log("Phase 3: Creating placeholders...");

  // In addMissingOnly mode, skip items that already have a Weekly Count record
  const itemsToCreate = addMissingOnly
    ? matchedItems.filter(id => !existingItemIds.has(id))
    : matchedItems;

  if (addMissingOnly) {
    const skipped = matchedItems.length - itemsToCreate.length;
    console.log(`  → ${matchedItems.length} qualified items: ${skipped} already in Weekly Counts, ${itemsToCreate.length} to add`);
  }

  const now = new Date();
  const staffField = safeField_(countsTable, CONFIG.countStaffField);

  const placeholders = itemsToCreate.map(itemId => {
    const fields = {
      [CONFIG.countItemLinkField]: [{ id: itemId }],
      [CONFIG.countQtyField]: 0,
      [CONFIG.countDateField]: now,
      [CONFIG.countSourceField]: { name: CONFIG.placeholderSourceName },
      [CONFIG.countConfirmedField]: false,
    };
    if (staffField) {
      fields[CONFIG.countStaffField] = { name: CONFIG.countStaffDefaultValue };
    }
    return { fields };
  });

  console.log(`  → Creating ${placeholders.length} placeholder records...`);

  if (!dryRun && placeholders.length > 0) {
    await batchCreate_(countsTable, placeholders);
    console.log("  ✓ Placeholders created");
  } else if (dryRun && placeholders.length > 0) {
    console.log("  → [DRY RUN] Would create placeholders");
  }

  // PHASE 4: Determine user (from newly created records)
  console.log("");
  console.log("Phase 4: Capturing user info...");
  
  let user = "(Unknown)";
  if (!dryRun && placeholders.length > 0) {
    user = await getUserFromModifiedRecords_(countsTable, 5);
    console.log(`  → User: ${user}`);
  } else if (dryRun) {
    user = "(Dry Run - no user capture)";
    console.log(`  → ${user}`);
  }

  // PHASE 5: Calculate execution time
  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log("");
  console.log("========================================");
  console.log("✓ CLEAR WEEKLY COUNT - Complete");
  console.log("========================================");
  console.log(`Execution time: ${executionTime}s`);
  if (addMissingOnly) {
    console.log(`Mode: Add Missing Only`);
    console.log(`Already tracked (skipped): ${matchedItems.length - itemsToCreate.length}`);
    console.log(`Added: ${placeholders.length}`);
  } else {
    console.log(`Deleted: ${toDelete.length}`);
    console.log(`Preserved: ${preservedCount}`);
    console.log(`Created: ${placeholders.length}`);
  }
  console.log("");

  // PHASE 6: Write audit log
  const itemTypeBreakdown = Object.entries(itemTypeCounts)
    .map(([type, count]) => `${type} (${count})`)
    .join(", ");

  const configUsed = JSON.stringify({
    includeInactive,
    dryRun,
    addMissingOnly,
    preserveVerifiedStocktakes,
    allowedItemTypes: CONFIG.allowedItemTypes,
  }, null, 2);

  const message = dryRun
    ? addMissingOnly
      ? `[DRY RUN] Add-missing-only: would add ${placeholders.length} new placeholders (${matchedItems.length - itemsToCreate.length} already tracked)`
      : `[DRY RUN] Would delete ${toDelete.length}, preserve ${preservedCount}, create ${placeholders.length} placeholders`
    : addMissingOnly
      ? `Add-missing-only: added ${placeholders.length} new placeholders (${matchedItems.length - itemsToCreate.length} already tracked)`
      : `Deleted ${toDelete.length} records, preserved ${preservedCount}, created ${placeholders.length} placeholders`;

  const details = 
    `Item Type Breakdown: ${itemTypeBreakdown || "(none)"}\n` +
    `Total Items Matched: ${matchedItems.length}\n` +
    `Existing Records Found: ${countsQuery.records.length}\n` +
    `Mode: ${dryRun ? "DRY RUN" : "LIVE"}`;

  const auditEntry = {
    scriptName: CONFIG.scriptName,
    status: "SUCCESS",
    message,
    details,
    user,
    executionTime: parseFloat(executionTime),
    configUsed,
  };

  if (!dryRun && auditLogTable) {
    console.log("Writing to Audit Log...");
    await writeAuditLog_(auditLogTable, auditEntry);
    console.log("✓ Audit log written");
  } else if (dryRun) {
    console.log("[DRY RUN] Would write audit log:");
    console.log(JSON.stringify(auditEntry, null, 2));
  } else if (!auditLogTable) {
    console.log("⚠️ Audit Log table not found - skipping audit log");
  }

  // Output variables (for potential future use in Airtable interface)
  output.set("deletedCount", toDelete.length);
  output.set("preservedVerifiedCount", preservedCount);
  output.set("createdCount", placeholders.length);
  output.set("matchedItemCount", matchedItems.length);
  output.set("status", "success");
  output.set("runDateIso", now.toISOString());
  output.set("executionTime", executionTime);
  output.set("user", user);
};

// Execute with error handling
(async () => {
  const startTime = Date.now();
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  try {
    await main();
  } catch (err) {
    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);

    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";

    console.log("");
    console.log("========================================");
    console.log("❌ CLEAR WEEKLY COUNT - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log(`Execution time: ${executionTime}s`);
    console.log("");

    // Try to write error to audit log
    if (!dryRun && auditLogTable) {
      try {
        const configUsed = JSON.stringify({
          includeInactive,
          dryRun,
          preserveVerifiedStocktakes,
        }, null, 2);

        await writeAuditLog_(auditLogTable, {
          scriptName: CONFIG.scriptName,
          status: "ERROR",
          message: `Script failed: ${errorMessage}`,
          details: `Error occurred during execution.\n\nStack trace available in Error Stack field.`,
          user: "(Error before user capture)",
          executionTime: parseFloat(executionTime),
          errorStack,
          configUsed,
        });

        console.log("✓ Error logged to Audit Log");
      } catch (logErr) {
        console.log(`⚠️ Could not write error to Audit Log: ${logErr.message}`);
      }
    }

    // Re-throw to show in Airtable UI
    throw err;
  }
})();