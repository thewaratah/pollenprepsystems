/****************************************************
 * WEEKLY COUNTS — FINALISE STOCKTAKE (INTERFACE BUTTON)
 * 
 * VERSION: 2.0 (with audit logging + recipe validation)
 *
 * Purpose:
 *   Validates and finalizes Weekly Counts stocktake.
 *   Sets Confirmed=true and normalizes Count Date.
 *   Optionally validates recipe integrity.
 *
 * Automation inputs (optional):
 *   - dryRun: boolean (default: false)
 *   - skipRecipeValidation: boolean (default: false)
 *
 * CHANGES IN v2.0:
 *   - Adds audit logging to "Audit Log" table
 *   - Enhanced progress indicators via console.log
 *   - Recipe integrity validation (WARNING mode)
 *   - Captures user from Last Modified By field
 *   - Detailed execution metrics
 ****************************************************/

const INPUT = (typeof input !== "undefined" && input?.config) ? input.config() : {};
const dryRun = INPUT.dryRun === true;
const skipRecipeValidation = INPUT.skipRecipeValidation === true;

const CONFIG = {
  timeZone: "Australia/Sydney",

  // Tables
  countsTableName: "Weekly Counts",
  itemsTableName: "Items",
  recipesTableName: "Recipes",
  recipeLinesTableName: "Recipe Lines",
  auditLogTableName: "Audit Log",

  // Weekly Counts fields
  countQtyField: "Stock Count",
  countDateField: "Count Date",
  countSourceField: "Count Source",
  countConfirmedField: "Confirmed",
  countItemLinkField: "Item",

  // Items fields
  itemNameField: "Item Name",
  itemTypeField: "Item Type",

  // Recipes fields
  recipeProducesItemField: "Item Name",
  recipeYieldField: "Yield Qty",

  // Recipe Lines fields
  lineRecipeField: "Recipe",
  lineComponentItemField: "Item",

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
  verifiedSourceName: "Stocktake (Verified)",
  batchItemType: "Batch",
  subRecipeItemTypes: ["Sub Recipe", "Sub-recipe"],
  
  // Limits
  batchSize: 50,
  maxBlankItemsToShow: 25,
  maxRecipeIssuesToShow: 25,

  // Script identifier
  scriptName: "FINALISE COUNT",
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

/** Helper: Normalize to minute precision */
function normalizeToMinute_(date) {
  const ms = date.getTime();
  const minuteMs = Math.floor(ms / 60000) * 60000;
  return new Date(minuteMs);
}

/** Helper: Safely get table */
function safeGetTable_(name) {
  try {
    return base.getTable(name);
  } catch (e) {
    return null;
  }
}

/** Helper: Batch update records */
async function batchUpdate_(table, updates) {
  const chunks = [];
  for (let i = 0; i < updates.length; i += CONFIG.batchSize) {
    chunks.push(updates.slice(i, i + CONFIG.batchSize));
  }

  for (const chunk of chunks) {
    await table.updateRecordsAsync(chunk);
  }
}

/** Helper: Get user from recently modified records */
async function getUserFromModifiedRecords_(table, sampleSize = 3) {
  try {
    const query = await table.selectRecordsAsync({
      sorts: [{ field: table.primaryField, direction: "desc" }],
    });

    if (!query.records.length) return "(Unknown)";

    const recentRecords = query.records.slice(0, sampleSize);
    
    for (const record of recentRecords) {
      const fieldNames = [
        "Last Modified By",
        "Modified By", 
        "Created By",
      ];

      for (const fieldName of fieldNames) {
        try {
          const field = table.getField(fieldName);
          const value = record.getCellValue(field);
          
          if (value && value.name) return value.name;
          if (value && value.email) return value.email;
        } catch (e) {
          continue;
        }
      }
    }

    return "(Unknown - no Last Modified By field found)";
  } catch (e) {
    console.log(`⚠️ Could not determine user: ${e.message}`);
    return "(Unknown)";
  }
}

/** Main audit logging function */
async function writeAuditLog_(auditLogTable, logEntry) {
  if (!auditLogTable) {
    throw new Error("Audit Log table not found. Please create it before running this script.");
  }

  const fields = {};

  const timestampField = auditLogTable.getField(CONFIG.auditTimestampField);
  if (timestampField) {
    fields[CONFIG.auditTimestampField] = new Date();
  }

  try {
    const scriptField = auditLogTable.getField(CONFIG.auditScriptNameField);
    if (scriptField.type === "singleSelect") {
      fields[CONFIG.auditScriptNameField] = { name: logEntry.scriptName || CONFIG.scriptName };
    } else {
      fields[CONFIG.auditScriptNameField] = logEntry.scriptName || CONFIG.scriptName;
    }
  } catch (e) {
    throw new Error(`Audit Log table missing required field: ${CONFIG.auditScriptNameField}`);
  }

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

  if (logEntry.message) {
    fields[CONFIG.auditMessageField] = logEntry.message;
  }

  if (logEntry.details) {
    fields[CONFIG.auditDetailsField] = logEntry.details;
  }

  if (logEntry.user) {
    fields[CONFIG.auditUserField] = logEntry.user;
  }

  if (logEntry.executionTime != null) {
    fields[CONFIG.auditExecutionTimeField] = logEntry.executionTime;
  }

  if (logEntry.errorStack) {
    fields[CONFIG.auditErrorStackField] = logEntry.errorStack;
  }

  if (logEntry.configUsed) {
    fields[CONFIG.auditConfigUsedField] = logEntry.configUsed;
  }

  await auditLogTable.createRecordAsync(fields);
}

/** Recipe Integrity Validator */
async function validateRecipeIntegrity_() {
  console.log("");
  console.log("Recipe Integrity Check: Starting...");

  const issues = {
    brokenLinks: [],
    missingRecipes: [],
    zeroYield: [],
    missingYield: [],
  };

  try {
    const itemsTable = base.getTable(CONFIG.itemsTableName);
    const recipesTable = base.getTable(CONFIG.recipesTableName);
    const linesTable = base.getTable(CONFIG.recipeLinesTableName);

    // Get all items
    const itemsQuery = await itemsTable.selectRecordsAsync({
      fields: [CONFIG.itemNameField, CONFIG.itemTypeField],
    });

    const itemsById = {};
    const batchItems = [];
    const subRecipeItems = [];

    for (const rec of itemsQuery.records) {
      itemsById[rec.id] = rec;
      const itemType = rec.getCellValue(CONFIG.itemTypeField)?.name;
      
      if (itemType === CONFIG.batchItemType) {
        batchItems.push(rec);
      } else if (CONFIG.subRecipeItemTypes.includes(itemType)) {
        subRecipeItems.push(rec);
      }
    }

    // Get all recipes
    const recipesQuery = await recipesTable.selectRecordsAsync({
      fields: [CONFIG.recipeProducesItemField, CONFIG.recipeYieldField],
    });

    const recipeByProducedItem = {};
    for (const rec of recipesQuery.records) {
      const produced = rec.getCellValue(CONFIG.recipeProducesItemField);
      if (!produced || !Array.isArray(produced) || produced.length === 0) continue;

      const itemId = produced[0]?.id;
      if (!itemId) continue;

      const yieldQty = rec.getCellValue(CONFIG.recipeYieldField);

      recipeByProducedItem[itemId] = {
        recipeId: rec.id,
        yieldQty,
      };

      // Check for zero or missing yield
      if (yieldQty == null) {
        const itemName = itemsById[itemId]?.getCellValue(CONFIG.itemNameField) || "(Unknown)";
        issues.missingYield.push({
          itemName,
          itemId,
          recipeId: rec.id,
        });
      } else if (typeof yieldQty === "number" && yieldQty <= 0) {
        const itemName = itemsById[itemId]?.getCellValue(CONFIG.itemNameField) || "(Unknown)";
        issues.zeroYield.push({
          itemName,
          itemId,
          recipeId: rec.id,
          yieldQty,
        });
      }
    }

    // Check Batch items for missing recipes
    for (const item of batchItems) {
      if (!recipeByProducedItem[item.id]) {
        issues.missingRecipes.push({
          itemName: item.getCellValue(CONFIG.itemNameField) || "(Unknown)",
          itemId: item.id,
          itemType: "Batch",
        });
      }
    }

    // Check Sub Recipe items for missing recipes
    for (const item of subRecipeItems) {
      if (!recipeByProducedItem[item.id]) {
        issues.missingRecipes.push({
          itemName: item.getCellValue(CONFIG.itemNameField) || "(Unknown)",
          itemId: item.id,
          itemType: item.getCellValue(CONFIG.itemTypeField)?.name || "Sub Recipe",
        });
      }
    }

    // Get all recipe lines and check for broken links
    const linesQuery = await linesTable.selectRecordsAsync({
      fields: [CONFIG.lineRecipeField, CONFIG.lineComponentItemField],
    });

    for (const line of linesQuery.records) {
      const recipeLink = line.getCellValue(CONFIG.lineRecipeField);
      const compLink = line.getCellValue(CONFIG.lineComponentItemField);

      if (!recipeLink || !Array.isArray(recipeLink) || recipeLink.length === 0) continue;
      if (!compLink || !Array.isArray(compLink) || compLink.length === 0) continue;

      const recipeId = recipeLink[0]?.id;
      const recipeName = recipeLink[0]?.name || "(Unknown Recipe)";
      const componentId = compLink[0]?.id;
      const componentName = compLink[0]?.name || "(Unknown Item)";

      if (!recipeId || !componentId) continue;

      // Check if component item still exists
      if (!itemsById[componentId]) {
        issues.brokenLinks.push({
          recipeId,
          recipeName,
          componentId,
          componentName,
        });
      }
    }

  } catch (e) {
    console.log(`⚠️ Recipe validation failed: ${e.message}`);
    return { issues, validationFailed: true };
  }

  const totalIssues = 
    issues.brokenLinks.length + 
    issues.missingRecipes.length + 
    issues.zeroYield.length + 
    issues.missingYield.length;

  if (totalIssues === 0) {
    console.log("  ✓ No recipe integrity issues found");
  } else {
    console.log(`  ⚠️  Found ${totalIssues} recipe integrity issues (WARNING mode)`);
    
    if (issues.brokenLinks.length > 0) {
      console.log(`     - Broken recipe links: ${issues.brokenLinks.length}`);
    }
    if (issues.missingRecipes.length > 0) {
      console.log(`     - Missing recipes: ${issues.missingRecipes.length}`);
    }
    if (issues.zeroYield.length > 0) {
      console.log(`     - Zero yield recipes: ${issues.zeroYield.length}`);
    }
    if (issues.missingYield.length > 0) {
      console.log(`     - Missing yield values: ${issues.missingYield.length}`);
    }
  }

  return { issues, validationFailed: false };
}

/** Format recipe issues for audit log */
function formatRecipeIssues_(issues) {
  const parts = [];

  if (issues.brokenLinks.length > 0) {
    parts.push("BROKEN RECIPE LINKS:");
    const sample = issues.brokenLinks.slice(0, CONFIG.maxRecipeIssuesToShow);
    for (const issue of sample) {
      parts.push(`  • Recipe "${issue.recipeName}" → Missing Item "${issue.componentName}" (${issue.componentId})`);
    }
    if (issues.brokenLinks.length > CONFIG.maxRecipeIssuesToShow) {
      parts.push(`  ... and ${issues.brokenLinks.length - CONFIG.maxRecipeIssuesToShow} more`);
    }
    parts.push("");
  }

  if (issues.missingRecipes.length > 0) {
    parts.push("MISSING RECIPES:");
    const sample = issues.missingRecipes.slice(0, CONFIG.maxRecipeIssuesToShow);
    for (const issue of sample) {
      parts.push(`  • "${issue.itemName}" (${issue.itemType}) has no recipe assigned`);
    }
    if (issues.missingRecipes.length > CONFIG.maxRecipeIssuesToShow) {
      parts.push(`  ... and ${issues.missingRecipes.length - CONFIG.maxRecipeIssuesToShow} more`);
    }
    parts.push("");
  }

  if (issues.zeroYield.length > 0) {
    parts.push("ZERO YIELD RECIPES:");
    const sample = issues.zeroYield.slice(0, CONFIG.maxRecipeIssuesToShow);
    for (const issue of sample) {
      parts.push(`  • "${issue.itemName}" recipe has yield = ${issue.yieldQty}`);
    }
    if (issues.zeroYield.length > CONFIG.maxRecipeIssuesToShow) {
      parts.push(`  ... and ${issues.zeroYield.length - CONFIG.maxRecipeIssuesToShow} more`);
    }
    parts.push("");
  }

  if (issues.missingYield.length > 0) {
    parts.push("MISSING YIELD VALUES:");
    const sample = issues.missingYield.slice(0, CONFIG.maxRecipeIssuesToShow);
    for (const issue of sample) {
      parts.push(`  • "${issue.itemName}" recipe has no yield quantity`);
    }
    if (issues.missingYield.length > CONFIG.maxRecipeIssuesToShow) {
      parts.push(`  ... and ${issues.missingYield.length - CONFIG.maxRecipeIssuesToShow} more`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

/** Main function */
async function main() {
  const startTime = Date.now();

  console.log("========================================");
  console.log("FINALISE COUNT - Starting");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Recipe Validation: ${skipRecipeValidation ? "DISABLED" : "ENABLED"}`);
  console.log("");

  const countsTable = base.getTable(CONFIG.countsTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  // PHASE 1: Recipe Integrity Validation (optional)
  let recipeValidation = null;
  if (!skipRecipeValidation) {
    recipeValidation = await validateRecipeIntegrity_();
  } else {
    console.log("Recipe Integrity Check: SKIPPED (disabled)");
  }

  // PHASE 2: Fetch all Weekly Counts
  console.log("");
  console.log("Phase 1: Fetching Weekly Counts...");
  
  const countsQuery = await countsTable.selectRecordsAsync({
    fields: [
      CONFIG.countQtyField,
      CONFIG.countDateField,
      CONFIG.countSourceField,
      CONFIG.countConfirmedField,
      CONFIG.countItemLinkField,
    ],
  });

  console.log(`  → Found ${countsQuery.records.length} total records`);

  // PHASE 3: Filter for unconfirmed records
  console.log("");
  console.log("Phase 2: Filtering for unconfirmed records...");

  const unconfirmedRecords = countsQuery.records.filter(rec => 
    rec.getCellValue(CONFIG.countConfirmedField) !== true
  );

  console.log(`  → Found ${unconfirmedRecords.length} unconfirmed records`);

  // Smart filtering (prioritize verified source if exists)
  let targetRecords = unconfirmedRecords;
  const hasSourceField = countsTable.getField(CONFIG.countSourceField);
  
  if (hasSourceField) {
    const unconfirmedVerified = unconfirmedRecords.filter(rec => {
      const source = rec.getCellValue(CONFIG.countSourceField);
      return source && source.name === CONFIG.verifiedSourceName;
    });

    if (unconfirmedVerified.length > 0) {
      targetRecords = unconfirmedVerified;
      console.log(`  → Filtering to ${targetRecords.length} "Stocktake (Verified)" records`);
    }
  }

  if (targetRecords.length === 0) {
    console.log("");
    console.log("========================================");
    console.log("✓ FINALISE COUNT - Nothing to Do");
    console.log("========================================");
    console.log("All records already confirmed.");
    console.log("");

    // Still write audit log
    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);

    if (!dryRun && auditLogTable) {
      await writeAuditLog_(auditLogTable, {
        scriptName: CONFIG.scriptName,
        status: "SUCCESS",
        message: "No unconfirmed records to finalize",
        details: `Total records: ${countsQuery.records.length}\nAlready confirmed: ${countsQuery.records.length}`,
        user: "(No changes made)",
        executionTime: parseFloat(executionTime),
        configUsed: JSON.stringify({ dryRun, skipRecipeValidation }, null, 2),
      });
    }

    return;
  }

  // PHASE 4: Validate for blanks
  console.log("");
  console.log("Phase 3: Validating stock counts...");

  const itemsWithBlanks = [];
  const itemsTable = safeGetTable_(CONFIG.itemsTableName);
  
  for (const rec of targetRecords) {
    const qty = rec.getCellValue(CONFIG.countQtyField);
    
    if (qty == null) {
      const itemId = rec.getCellValue(CONFIG.countItemLinkField)?.[0]?.id;
      let itemName = "(Unknown Item)";
      
      if (itemId && itemsTable) {
        try {
          const itemRec = await itemsTable.selectRecordAsync(itemId, {
            fields: [CONFIG.itemNameField],
          });
          itemName = itemRec?.getCellValue(CONFIG.itemNameField) || "(Unknown Item)";
        } catch (e) {
          // Ignore
        }
      }
      
      itemsWithBlanks.push({ recordId: rec.id, itemName });
    }
  }

  if (itemsWithBlanks.length > 0) {
    console.log(`  ❌ Found ${itemsWithBlanks.length} items with blank Stock Count`);
    
    const sample = itemsWithBlanks.slice(0, CONFIG.maxBlankItemsToShow);
    console.log("");
    console.log("Items with blank counts:");
    for (const item of sample) {
      console.log(`  • ${item.itemName}`);
    }
    
    if (itemsWithBlanks.length > CONFIG.maxBlankItemsToShow) {
      console.log(`  ... and ${itemsWithBlanks.length - CONFIG.maxBlankItemsToShow} more`);
    }

    throw new Error(
      `Cannot finalize: ${itemsWithBlanks.length} items have blank Stock Count. ` +
      `Please set all Stock Count values (0 is acceptable, blank is not), then run FINALISE again.`
    );
  }

  console.log(`  ✓ All ${targetRecords.length} items have Stock Count values`);

  // PHASE 5: Normalize timestamp and prepare updates
  console.log("");
  console.log("Phase 4: Preparing finalization...");

  const now = new Date();
  const normalizedDate = normalizeToMinute_(now);

  console.log(`  → Timestamp: ${formatSydneyTimestamp_(normalizedDate)}`);
  console.log(`  → ISO: ${normalizedDate.toISOString()}`);

  const updates = targetRecords.map(rec => ({
    id: rec.id,
    fields: {
      [CONFIG.countConfirmedField]: true,
      [CONFIG.countDateField]: normalizedDate,
      [CONFIG.countSourceField]: { name: CONFIG.verifiedSourceName },
    }
  }));

  console.log(`  → Prepared ${updates.length} updates`);

  // PHASE 6: Execute updates
  console.log("");
  console.log("Phase 5: Finalizing counts...");

  if (!dryRun) {
    await batchUpdate_(countsTable, updates);
    console.log(`  ✓ Finalized ${updates.length} records`);
  } else {
    console.log(`  → [DRY RUN] Would finalize ${updates.length} records`);
  }

  // PHASE 7: Capture user
  console.log("");
  console.log("Phase 6: Capturing user info...");
  
  let user = "(Unknown)";
  if (!dryRun) {
    user = await getUserFromModifiedRecords_(countsTable, 5);
    console.log(`  → User: ${user}`);
  } else {
    user = "(Dry Run - no user capture)";
    console.log(`  → ${user}`);
  }

  // PHASE 8: Calculate execution time
  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  // PHASE 9: Summary
  console.log("");
  console.log("========================================");
  
  const hasRecipeWarnings = recipeValidation && 
    (recipeValidation.issues.brokenLinks.length > 0 ||
     recipeValidation.issues.missingRecipes.length > 0 ||
     recipeValidation.issues.zeroYield.length > 0 ||
     recipeValidation.issues.missingYield.length > 0);

  if (hasRecipeWarnings) {
    console.log("⚠️  FINALISE COUNT - Complete with Warnings");
  } else {
    console.log("✓ FINALISE COUNT - Complete");
  }
  
  console.log("========================================");
  console.log(`Execution time: ${executionTime}s`);
  console.log(`Finalized: ${updates.length} records`);
  console.log(`Count Date: ${formatSydneyTimestamp_(normalizedDate)}`);
  
  if (hasRecipeWarnings) {
    const totalIssues = 
      recipeValidation.issues.brokenLinks.length +
      recipeValidation.issues.missingRecipes.length +
      recipeValidation.issues.zeroYield.length +
      recipeValidation.issues.missingYield.length;
    
    console.log("");
    console.log(`⚠️  Recipe Warnings: ${totalIssues} issues found`);
    console.log("   Fix these before running GENERATE PREP RUN");
    console.log("   (See Audit Log for details)");
  }
  console.log("");

  // PHASE 10: Write audit log
  const configUsed = JSON.stringify({
    dryRun,
    skipRecipeValidation,
    verifiedSourceName: CONFIG.verifiedSourceName,
  }, null, 2);

  const message = dryRun
    ? `[DRY RUN] Would finalize ${updates.length} records`
    : `Finalized ${updates.length} records`;

  let details = 
    `Total records scanned: ${countsQuery.records.length}\n` +
    `Unconfirmed records: ${unconfirmedRecords.length}\n` +
    `Records finalized: ${updates.length}\n` +
    `Count Date (Sydney): ${formatSydneyTimestamp_(normalizedDate)}\n` +
    `Count Date (ISO): ${normalizedDate.toISOString()}\n` +
    `Mode: ${dryRun ? "DRY RUN" : "LIVE"}`;

  if (recipeValidation && !recipeValidation.validationFailed) {
    const totalIssues = 
      recipeValidation.issues.brokenLinks.length +
      recipeValidation.issues.missingRecipes.length +
      recipeValidation.issues.zeroYield.length +
      recipeValidation.issues.missingYield.length;

    details += `\n\nRECIPE INTEGRITY CHECK:\n`;
    details += `Total issues: ${totalIssues}\n`;
    
    if (totalIssues > 0) {
      details += `\n${formatRecipeIssues_(recipeValidation.issues)}`;
      details += `\n⚠️  Fix these issues before running GENERATE PREP RUN or it may fail.`;
    } else {
      details += `✓ No issues found`;
    }
  }

  const auditStatus = hasRecipeWarnings ? "WARNING" : "SUCCESS";

  const auditEntry = {
    scriptName: CONFIG.scriptName,
    status: auditStatus,
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

  // Output variables
  output.set("status", auditStatus.toLowerCase());
  output.set("targetCount", updates.length);
  output.set("countDateWritable", formatSydneyTimestamp_(normalizedDate));
  output.set("stampedCountDateIso", normalizedDate.toISOString());
  output.set("executionTime", executionTime);
  output.set("user", user);
  
  if (recipeValidation) {
    output.set("recipeIssuesFound", hasRecipeWarnings);
    output.set("recipeIssuesCount", 
      recipeValidation.issues.brokenLinks.length +
      recipeValidation.issues.missingRecipes.length +
      recipeValidation.issues.zeroYield.length +
      recipeValidation.issues.missingYield.length
    );
  }
}

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
    console.log("❌ FINALISE COUNT - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log(`Execution time: ${executionTime}s`);
    console.log("");

    // Write error to audit log
    if (!dryRun && auditLogTable) {
      try {
        const configUsed = JSON.stringify({
          dryRun,
          skipRecipeValidation,
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

    throw err;
  }
})();