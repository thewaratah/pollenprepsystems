/****************************************************
 * THE WARATAH - PREP RUN GENERATOR
 *
 * VERSION: 2.2 (The Waratah - scope fix v2 + audit logging)
 *
 * VENUE: The Waratah
 * TRIGGER: Sunday 11:15pm (15 minutes after FinaliseCount at 11pm)
 *
 * Purpose:
 *   Finds latest verified stocktake, calculates shortfalls,
 *   generates Prep Tasks and Ingredient Requirements.
 *   Optionally rebuilds existing run for same stocktake.
 *
 * Automation inputs (optional):
 *   - requestId: Record ID from Prep Run Requests table
 *   - prepWeek: date/time override
 *   - dryRun: boolean (default: false)
 *   - allowDuplicates: boolean (default: false)
 *
 * CHANGES IN v2.2 (The Waratah):
 *   - Fixed scope issue with IIFE access to requestIdInput/dryRun
 *   - Changed INPUT initialization from let/try-catch to const IIFE
 *   - Corrected trigger time documentation (11:15pm not 11:45pm)
 *
 * CHANGES IN v2.1 (The Waratah):
 *   - Fixed scope issue in error handler
 *   - Renamed to Waratah_GeneratePrepRun for venue differentiation
 *   - Updated CONFIG.scriptName to "WARATAH - GENERATE PREP RUN"
 *   - Added defensive INPUT initialization
 *
 * CHANGES IN v2.0:
 *   - Adds audit logging to "Audit Log" table
 *   - Enhanced progress indicators via console.log
 *   - Buffer Multiplier support for Sub Recipe items
 *   - Suggested Qty field calculation (Target Qty × Buffer)
 *   - Captures user from Last Modified By field
 *   - Detailed execution metrics
 ****************************************************/

// Defensive INPUT initialization - must be at top level for error handler scope
const INPUT = (() => {
  try {
    return (typeof input !== "undefined" && input?.config) ? input.config() : {};
  } catch (e) {
    console.log("⚠️ Warning: Could not load input config, using defaults");
    return {};
  }
})();

const requestIdInput = INPUT.requestId || null;
const prepWeekOverrideRaw = INPUT.prepWeek || null;
const dryRun = INPUT.dryRun === true;
const allowDuplicates = INPUT.allowDuplicates === true;

const CONFIG = {
  timeZone: "Australia/Sydney",

  // Tables
  itemsTableName: "Items",
  recipesTableName: "Recipes",
  recipeLinesTableName: "Recipe Lines",
  parTableName: "Par Levels",
  countsTableName: "Weekly Counts",
  runsTableName: "Prep Runs",
  tasksTableName: "Prep Tasks",
  reqTableName: "Ingredient Requirements",
  requestsTableName: "Prep Run Requests",
  auditLogTableName: "Audit Log",

  // Prep Run Requests fields (optional logging)
  requestPrepWeekOverrideField: "Prep Week Override",
  requestStatusField: "Status",
  requestErrorField: "Error",
  requestRunLinkField: "Prep Run",
  requestStartedAtField: "Started At",
  requestFinishedAtField: "Finished At",
  requestStocktakeDateField: "Stocktake Count Date",

  // Items fields
  itemTypeField: "Item Type",
  itemActiveField: "Active",
  itemSupplierLinkField: "Supplier",
  itemSupplierNameLookupField: "Supplier Name",
  itemProductCategoryLookupField: "Product Category",
  itemOrderingStaffLookupField: "Ordering Staff",
  itemBufferMultiplierField: "Buffer Multiplier", // NEW for 150% feature

  // Weekly Counts fields
  countDateField: "Count Date",
  countItemLinkField: "Item",
  countQtyField: "Stock Count",
  countSourceField: "Count Source",
  countConfirmedField: "Confirmed",

  // Par Levels fields
  parItemLinkField: "Item Link",
  parQtyField: "Par Qty",

  // Recipes fields
  recipeProducesItemField: "Item Name",
  recipeYieldField: "Yield Qty",

  // Recipe Lines fields
  lineRecipeField: "Recipe",
  lineComponentItemField: "Item",
  lineQtyField: "Qty",

  // Prep Runs fields
  runPrepWeekField: "Prep Week",
  runReadyField: "Ready",
  runNotesField: "Notes / Handover Notes",

  // Prep Tasks fields
  taskRunField: "Prep Run",
  taskItemToProduceField: "Item Needed",
  taskRecipeUsedField: "Recipe Used",
  taskTargetQtyField: "Target Qty",
  taskBatchesNeededField: "Batches Needed",
  taskSuggestedQtyField: "Suggested Qty (Buffer)", // NEW for 150% feature

  // Ingredient Requirements fields
  reqRunField: "Prep Run",
  reqRecipeField: "Recipe Link",
  reqItemNeededField: "Item Link",
  reqTotalQtyField: "Total Qty Needed",

  // Ingredient Requirements static snapshot fields
  reqSupplierLinkStaticField: "Supplier (Static)",
  reqSupplierNameStaticField: "Supplier Name (Static)",
  reqProductCategoryStaticField: "Product Category (Static)",
  reqOrderingStaffStaticField: "Ordering Staff (Static)",

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
  auditRelatedRunField: "Related Prep Run",

  // Behaviour
  allowedTopLevelItemTypes: new Set(["Batch", "Sub Recipe", "Sub-recipe", "Garnish", "Other"]),
  subRecipeItemTypes: new Set(["Sub Recipe", "Sub-recipe"]),
  ingredientItemType: "Ingredient",

  includeSubRecipesInRequirements: true,
  includeSubRecipesEvenIfProduced: true,
  scaleRecipesExactly: true,

  subRecipeMaintainParBuffer: false,

  // Stocktake grouping: same minute window
  countTimeToleranceMinutes: 0,

  // Limits / batching
  batchSize: 50,
  maxQueueOps: 20000,

  // Script identifier
  scriptName: "WARATAH - GENERATE PREP RUN",
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

const safeGetTable_ = (name) => {
  try {
    return base.getTable(name);
  } catch {
    return null;
  }
};

const safeField_ = (table, fieldNameOrId) => {
  try {
    return table.getField(fieldNameOrId);
  } catch {
    return null;
  }
};

const toDate_ = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};

const normalizeToMinuteMs_ = (date) => {
  return Math.floor(date.getTime() / 60000) * 60000;
};

const formatSydneyDDMMYYYYHHMM_ = (d) => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
};

const getSingleSelectName_ = (record, fieldName) => {
  const v = record.getCellValue(fieldName);
  return v && typeof v.name === "string" ? v.name : null;
};

const getLinkedRecordIds_ = (record, fieldName) => {
  const v = record.getCellValue(fieldName);
  if (!v || !Array.isArray(v)) return [];
  return v.map((x) => x?.id).filter(Boolean);
};

const getLinkedRecordId_ = (record, fieldName) => {
  const ids = getLinkedRecordIds_(record, fieldName);
  return ids.length ? ids[0] : null;
};

const coerceLookupToText_ = (value) => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const parts = value
      .map((x) => {
        if (x == null) return "";
        if (typeof x === "string" || typeof x === "number" || typeof x === "boolean") return String(x);
        if (typeof x === "object") {
          if (typeof x.name === "string") return x.name;
          if (typeof x.email === "string") return x.email;
          if (typeof x.id === "string") return x.id;
          return JSON.stringify(x);
        }
        return String(x);
      })
      .filter((s) => s.trim().length > 0);

    return [...new Set(parts)].join(", ");
  }

  if (typeof value === "object") {
    if (typeof value.name === "string") return value.name;
    if (typeof value.email === "string") return value.email;
    return JSON.stringify(value);
  }

  return String(value);
};

const firstToken_ = (text) => {
  if (!text) return "";
  return String(text).split(",")[0].trim();
};

const chunk_ = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const callAirtable_ = async (label, fn, payloadForError) => {
  try {
    return await fn();
  } catch (e) {
    const payload = payloadForError ? `\nPayload:\n${JSON.stringify(payloadForError, null, 2)}` : "";
    throw new Error(`❌ Airtable request failed: ${label}\n${e?.message || String(e)}${payload}`);
  }
};

const batchCreate_ = async (table, records) => {
  for (let i = 0; i < records.length; i += CONFIG.batchSize) {
    const c = records.slice(i, i + CONFIG.batchSize);
    await callAirtable_(
      `createRecordsAsync table="${table.name}" chunkIndex=${i}`,
      () => table.createRecordsAsync(c),
      { firstRecordFields: c[0]?.fields || null }
    );
  }
};

const batchDelete_ = async (table, recordIds) => {
  for (let i = 0; i < recordIds.length; i += CONFIG.batchSize) {
    const c = recordIds.slice(i, i + CONFIG.batchSize);
    await callAirtable_(
      `deleteRecordsAsync table="${table.name}" chunkIndex=${i}`,
      () => table.deleteRecordsAsync(c)
    );
  }
};

const setTextOrSelectField_ = (fieldsObj, table, fieldName, valueText) => {
  const field = safeField_(table, fieldName);
  if (!field) return;

  const v = (valueText || "").trim();
  if (!v) return;

  if (field.type === "singleSelect") {
    fieldsObj[fieldName] = { name: firstToken_(v) };
  } else if (field.type === "multipleSelects") {
    fieldsObj[fieldName] = [{ name: firstToken_(v) }];
  } else {
    fieldsObj[fieldName] = v;
  }
};

const setSingleSupplierLinkIfPossible_ = (fieldsObj, table, fieldName, supplierIds) => {
  const field = safeField_(table, fieldName);
  if (!field) return;
  if (field.type !== "multipleRecordLinks") return;
  if (!Array.isArray(supplierIds) || supplierIds.length === 0) return;
  fieldsObj[fieldName] = [{ id: supplierIds[0] }];
};

/** Helper: Get user from recently modified records */
const getUserFromModifiedRecords_ = async (table, sampleSize = 3) => {
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
};

/** Main audit logging function */
const writeAuditLog_ = async (auditLogTable, logEntry) => {
  if (!auditLogTable) {
    throw new Error("Audit Log table not found. Please create it before running this script.");
  }

  const fields = {};

  const timestampField = safeField_(auditLogTable, CONFIG.auditTimestampField);
  if (timestampField) {
    fields[CONFIG.auditTimestampField] = new Date();
  }

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

  // Link to Prep Run if provided
  if (logEntry.relatedRunId) {
    const runLinkField = safeField_(auditLogTable, CONFIG.auditRelatedRunField);
    if (runLinkField && runLinkField.type === "multipleRecordLinks") {
      fields[CONFIG.auditRelatedRunField] = [{ id: logEntry.relatedRunId }];
    }
  }

  await auditLogTable.createRecordAsync(fields);
};

const buildRequestUpdateFields_ = (requestsTable, partial) => {
  const fields = {};

  const statusField = safeField_(requestsTable, CONFIG.requestStatusField);
  if (partial.statusName && statusField) {
    if (statusField.type === "singleSelect") fields[CONFIG.requestStatusField] = { name: partial.statusName };
    else fields[CONFIG.requestStatusField] = String(partial.statusName);
  }

  const errField = safeField_(requestsTable, CONFIG.requestErrorField);
  if (partial.errorText != null && errField) fields[CONFIG.requestErrorField] = String(partial.errorText || "");

  const startedField = safeField_(requestsTable, CONFIG.requestStartedAtField);
  if (partial.startedAt && startedField && (startedField.type === "date" || startedField.type === "dateTime")) {
    fields[CONFIG.requestStartedAtField] = partial.startedAt;
  }

  const finishedField = safeField_(requestsTable, CONFIG.requestFinishedAtField);
  if (partial.finishedAt && finishedField && (finishedField.type === "date" || finishedField.type === "dateTime")) {
    fields[CONFIG.requestFinishedAtField] = partial.finishedAt;
  }

  const runLinkField = safeField_(requestsTable, CONFIG.requestRunLinkField);
  if (partial.runId && runLinkField && runLinkField.type === "multipleRecordLinks") {
    fields[CONFIG.requestRunLinkField] = [{ id: partial.runId }];
  }

  const stocktakeField = safeField_(requestsTable, CONFIG.requestStocktakeDateField);
  if (partial.stocktakeDate && stocktakeField && (stocktakeField.type === "date" || stocktakeField.type === "dateTime")) {
    fields[CONFIG.requestStocktakeDateField] = partial.stocktakeDate;
  }

  return fields;
};

const safeUpdateRequest_ = async (requestsTable, requestId, partial) => {
  if (!requestsTable || !requestId) return;
  const fields = buildRequestUpdateFields_(requestsTable, partial);
  if (!Object.keys(fields).length) return;
  try {
    await requestsTable.updateRecordAsync(requestId, fields);
  } catch (e) {
    console.log(`⚠️ Request logging failed (ignored): ${e?.message || String(e)}`);
  }
};

const main = async () => {
  const startTime = Date.now();

  console.log("========================================");
  console.log("GENERATE PREP RUN - Starting");
  console.log("========================================");
  console.log(`Time: ${formatSydneyTimestamp_(new Date())}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Allow Duplicates: ${allowDuplicates}`);
  console.log("");

  const requestsTable = requestIdInput ? safeGetTable_(CONFIG.requestsTableName) : null;
  let requestRecord = null;
  let shouldTrackRequest = false; // Only enable if we have a valid request ID

  if (requestIdInput && requestsTable) {
    // Validate that requestIdInput looks like an Airtable record ID
    const isRecordId = typeof requestIdInput === "string" && requestIdInput.startsWith("rec") && requestIdInput.length >= 17;

    if (!isRecordId) {
      console.log(`⚠️ Warning: requestId "${requestIdInput}" doesn't look like an Airtable record ID`);
      console.log(`   Expected format: "recXXXXXXXXXXXXXX" (starts with "rec")`);
      console.log(`   Received: "${requestIdInput}" (looks like a timestamp or other value)`);
      console.log(`   `);
      console.log(`   ⚠️  AUTOMATION CONFIGURATION ERROR:`);
      console.log(`   The automation is passing the wrong value. It should pass:`);
      console.log(`   - The Record ID from the trigger (e.g., {Record ID})`);
      console.log(`   - NOT a timestamp, date field, or created time`);
      console.log(`   `);
      console.log(`   Continuing WITHOUT request tracking...`);
      // Keep shouldTrackRequest = false
    } else {
      requestRecord = await callAirtable_(
        `selectRecordAsync Prep Run Requests requestId="${requestIdInput}"`,
        () => requestsTable.selectRecordAsync(requestIdInput)
      );
      if (!requestRecord) {
        throw new Error(`❌ requestId "${requestIdInput}" is not a record in "${CONFIG.requestsTableName}".`);
      }

      await safeUpdateRequest_(requestsTable, requestIdInput, {
        statusName: "Running",
        errorText: "",
        startedAt: new Date(),
      });

      shouldTrackRequest = true; // Enable tracking for valid request ID
    }
  }

  let prepWeekOverride = toDate_(prepWeekOverrideRaw);
  if (!prepWeekOverride && requestRecord) {
    const f = safeField_(requestsTable, CONFIG.requestPrepWeekOverrideField);
    if (f && (f.type === "date" || f.type === "dateTime")) {
      prepWeekOverride = toDate_(requestRecord.getCellValue(CONFIG.requestPrepWeekOverrideField));
    }
  }

  const itemsTable = base.getTable(CONFIG.itemsTableName);
  const recipesTable = base.getTable(CONFIG.recipesTableName);
  const linesTable = base.getTable(CONFIG.recipeLinesTableName);
  const parTable = base.getTable(CONFIG.parTableName);
  const countsTable = base.getTable(CONFIG.countsTableName);
  const runsTable = base.getTable(CONFIG.runsTableName);
  const tasksTable = base.getTable(CONFIG.tasksTableName);
  const reqTable = base.getTable(CONFIG.reqTableName);
  const auditLogTable = safeGetTable_(CONFIG.auditLogTableName);

  // PHASE 1: Latest VERIFIED stocktake timestamp
  console.log("Phase 1: Finding latest verified stocktake...");

  const countsQuery = await countsTable.selectRecordsAsync({
    fields: [
      CONFIG.countDateField,
      CONFIG.countItemLinkField,
      CONFIG.countQtyField,
      CONFIG.countConfirmedField,
      CONFIG.countSourceField,
    ],
  });

  let latestCountDate = null;
  for (const rec of countsQuery.records) {
    if (rec.getCellValue(CONFIG.countConfirmedField) !== true) continue;
    if (rec.getCellValue(CONFIG.countSourceField)?.name !== "Stocktake (Verified)") continue;

    const d = toDate_(rec.getCellValue(CONFIG.countDateField));
    if (!d) continue;
    if (!latestCountDate || d.getTime() > latestCountDate.getTime()) latestCountDate = d;
  }

  if (!latestCountDate) {
    throw new Error("❌ No VERIFIED stocktake found. Check Weekly Counts: Confirmed=true + Count Source=Stocktake (Verified).");
  }

  console.log(`  → Found stocktake: ${formatSydneyDDMMYYYYHHMM_(latestCountDate)}`);

  if (shouldTrackRequest) {
    await safeUpdateRequest_(requestsTable, requestIdInput, { stocktakeDate: latestCountDate });
  }

  const latestMinuteMs = normalizeToMinuteMs_(latestCountDate);
  const stocktakeMinuteIso = new Date(latestMinuteMs).toISOString();
  const toleranceMs = Math.max(0, CONFIG.countTimeToleranceMinutes) * 60000;

  console.log(`  → Stocktake key: ${stocktakeMinuteIso}`);

  // PHASE 2: Build onHand snapshot
  console.log("");
  console.log("Phase 2: Building stock snapshot...");

  const onHand = {};
  const itemLatestTime = {};
  const missingCounts = [];

  for (const rec of countsQuery.records) {
    if (rec.getCellValue(CONFIG.countConfirmedField) !== true) continue;
    if (rec.getCellValue(CONFIG.countSourceField)?.name !== "Stocktake (Verified)") continue;

    const d = toDate_(rec.getCellValue(CONFIG.countDateField));
    if (!d) continue;

    const tMinute = normalizeToMinuteMs_(d);
    if (Math.abs(tMinute - latestMinuteMs) > toleranceMs) continue;

    const itemId = getLinkedRecordId_(rec, CONFIG.countItemLinkField);
    if (!itemId) continue;

    const qty = rec.getCellValue(CONFIG.countQtyField);
    if (qty == null) {
      missingCounts.push(itemId);
      continue;
    }

    const t = d.getTime();
    const prevT = itemLatestTime[itemId];
    if (prevT == null || t >= prevT) {
      itemLatestTime[itemId] = t;
      onHand[itemId] = typeof qty === "number" ? qty : 0;
    }
  }

  if (missingCounts.length) {
    throw new Error(
      `❌ Verified stocktake has blanks near ${formatSydneyDDMMYYYYHHMM_(latestCountDate)}. ${missingCounts.length} items missing Stock Count.`
    );
  }

  console.log(`  → Loaded ${Object.keys(onHand).length} item stock counts`);

  // PHASE 3: Par lookup
  console.log("");
  console.log("Phase 3: Loading par levels...");

  const parQuery = await parTable.selectRecordsAsync({ fields: [CONFIG.parItemLinkField, CONFIG.parQtyField] });
  const par = {};
  for (const rec of parQuery.records) {
    const itemId = getLinkedRecordId_(rec, CONFIG.parItemLinkField);
    if (!itemId) continue;
    const qty = rec.getCellValue(CONFIG.parQtyField);
    par[itemId] = typeof qty === "number" ? qty : 0;
  }

  console.log(`  → Loaded ${Object.keys(par).length} par levels`);

  // PHASE 4: Items lookup (including Buffer Multiplier)
  console.log("");
  console.log("Phase 4: Loading items data...");

  const itemsQuery = await itemsTable.selectRecordsAsync({
    fields: [
      CONFIG.itemTypeField,
      CONFIG.itemActiveField,
      CONFIG.itemSupplierLinkField,
      CONFIG.itemSupplierNameLookupField,
      CONFIG.itemProductCategoryLookupField,
      CONFIG.itemOrderingStaffLookupField,
      CONFIG.itemBufferMultiplierField, // NEW
    ],
  });

  const itemTypeById = {};
  const itemActiveById = {};
  const itemMetaById = {};
  const itemBufferById = {}; // NEW

  // Hoist safeField_() check outside the loop — field existence is constant per run
  const bufferField = safeField_(itemsTable, CONFIG.itemBufferMultiplierField);

  for (const rec of itemsQuery.records) {
    const itemId = rec.id;
    itemTypeById[itemId] = getSingleSelectName_(rec, CONFIG.itemTypeField);
    itemActiveById[itemId] = rec.getCellValue(CONFIG.itemActiveField) === true;

    itemMetaById[itemId] = {
      supplierIds: getLinkedRecordIds_(rec, CONFIG.itemSupplierLinkField),
      supplierName: coerceLookupToText_(rec.getCellValue(CONFIG.itemSupplierNameLookupField)),
      category: coerceLookupToText_(rec.getCellValue(CONFIG.itemProductCategoryLookupField)),
      orderingStaff: coerceLookupToText_(rec.getCellValue(CONFIG.itemOrderingStaffLookupField)),
    };

    // NEW: Read Buffer Multiplier (default to 1.0 if blank)
    if (bufferField) {
      const bufferValue = rec.getCellValue(CONFIG.itemBufferMultiplierField);
      const buffer = typeof bufferValue === "number" && bufferValue > 0 ? bufferValue : 1.0;
      itemBufferById[itemId] = buffer;
    } else {
      itemBufferById[itemId] = 1.0;
    }
  }

  console.log(`  → Loaded ${itemsQuery.records.length} items`);

  // PHASE 5: Recipes lookup
  console.log("");
  console.log("Phase 5: Loading recipes...");

  const recipesQuery = await recipesTable.selectRecordsAsync({
    fields: [CONFIG.recipeProducesItemField, CONFIG.recipeYieldField],
  });

  const recipeByProducedItem = {};
  for (const rec of recipesQuery.records) {
    const produced = rec.getCellValue(CONFIG.recipeProducesItemField);
    if (!produced || !Array.isArray(produced) || produced.length === 0) continue;

    const itemId = produced[0]?.id;
    if (!itemId) continue;

    const yieldRaw = rec.getCellValue(CONFIG.recipeYieldField);
    const yieldQty = typeof yieldRaw === "number" && yieldRaw > 0 ? yieldRaw : 1;

    recipeByProducedItem[itemId] = { recipeId: rec.id, yieldQty };
  }

  console.log(`  → Loaded ${recipesQuery.records.length} recipes`);

  // PHASE 6: Recipe lines lookup + validate
  console.log("");
  console.log("Phase 6: Loading recipe lines...");

  const linesQuery = await linesTable.selectRecordsAsync({
    fields: [CONFIG.lineRecipeField, CONFIG.lineComponentItemField, CONFIG.lineQtyField],
  });

  const linesByRecipeId = {};
  const brokenRefs = [];

  for (const line of linesQuery.records) {
    const recipeLink = line.getCellValue(CONFIG.lineRecipeField);
    const compLink = line.getCellValue(CONFIG.lineComponentItemField);
    if (!recipeLink || !Array.isArray(recipeLink) || recipeLink.length === 0) continue;
    if (!compLink || !Array.isArray(compLink) || compLink.length === 0) continue;

    const recipeId = recipeLink[0]?.id;
    const recipeName = recipeLink[0]?.name || "";
    const componentId = compLink[0]?.id;
    const componentName = compLink[0]?.name || "";
    if (!recipeId || !componentId) continue;

    if (!itemTypeById[componentId]) {
      brokenRefs.push({ recipeId, recipeName, componentId, componentName });
      continue;
    }

    const qtyRaw = line.getCellValue(CONFIG.lineQtyField);
    const qtyPerBatch = typeof qtyRaw === "number" ? qtyRaw : 0;

    if (!linesByRecipeId[recipeId]) linesByRecipeId[recipeId] = [];
    linesByRecipeId[recipeId].push({ componentId, qtyPerBatch });
  }

  if (brokenRefs.length) {
    const sample = brokenRefs
      .slice(0, 25)
      .map(
        (x) =>
          `• Recipe: ${x.recipeName || x.recipeId} (${x.recipeId}) -> Missing Item: ${x.componentName || x.componentId} (${x.componentId})`
      )
      .join("\n");
    throw new Error(
      `❌ Broken Recipe Lines detected.\nFix Recipe Lines item links, then rerun.\n\nSample:\n${sample}\n\nTotal broken links: ${brokenRefs.length}`
    );
  }

  console.log(`  → Loaded ${linesQuery.records.length} recipe lines`);

  // PHASE 7: Find or create Prep Run
  console.log("");
  console.log("Phase 7: Finding or creating Prep Run...");

  const runsQuery = await runsTable.selectRecordsAsync({
    fields: [CONFIG.runPrepWeekField, CONFIG.runNotesField],
  });

  let runId = null;
  let runAction = "created";

  if (!allowDuplicates) {
    for (const run of runsQuery.records) {
      const notes = run.getCellValue(CONFIG.runNotesField) || "";
      if (notes.includes(`STOCKTAKE_MINUTE_ISO=${stocktakeMinuteIso}`)) {
        runId = run.id;
        runAction = "found_existing";
        console.log(`  → Found existing run: ${runId}`);
        break;
      }
    }
  }

  if (!runId && !dryRun) {
    const runDate = prepWeekOverride ? new Date(prepWeekOverride) : new Date();
    runDate.setMilliseconds(0);

    const runNotes =
      `Sydney stocktake: ${formatSydneyDDMMYYYYHHMM_(latestCountDate)}\n` +
      `Stocktake ISO: ${latestCountDate.toISOString()}\n` +
      `STOCKTAKE_MINUTE_ISO=${stocktakeMinuteIso}\n` +
      `Created: ${new Date().toISOString()}`;

    const fields = {
      [CONFIG.runPrepWeekField]: runDate,
      [CONFIG.runReadyField]: false,
      [CONFIG.runNotesField]: runNotes,
    };

    runId = await callAirtable_(
      `createRecordAsync Prep Runs`,
      () => runsTable.createRecordAsync(fields),
      fields
    );

    runAction = "created";
    console.log(`  → Created new run: ${runId}`);
  } else if (!runId && dryRun) {
    runId = "DRY_RUN";
    runAction = "dry_run";
    console.log(`  → [DRY RUN] Would create new run`);
  }

  if (shouldTrackRequest) {
    await safeUpdateRequest_(requestsTable, requestIdInput, { runId: runId !== "DRY_RUN" ? runId : null });
  }

  // PHASE 8: Delete existing children if rebuilding
  if (runAction === "found_existing" && !dryRun) {
    console.log("");
    console.log("Phase 8: Deleting existing tasks and requirements...");

    const existingTasksQuery = await tasksTable.selectRecordsAsync({ fields: [CONFIG.taskRunField] });
    const tasksToDelete = existingTasksQuery.records
      .filter(rec => getLinkedRecordId_(rec, CONFIG.taskRunField) === runId)
      .map(rec => rec.id);

    const existingReqsQuery = await reqTable.selectRecordsAsync({ fields: [CONFIG.reqRunField] });
    const reqsToDelete = existingReqsQuery.records
      .filter(rec => getLinkedRecordId_(rec, CONFIG.reqRunField) === runId)
      .map(rec => rec.id);

    console.log(`  → Deleting ${tasksToDelete.length} tasks...`);
    if (tasksToDelete.length > 0) {
      await batchDelete_(tasksTable, tasksToDelete);
    }

    console.log(`  → Deleting ${reqsToDelete.length} requirements...`);
    if (reqsToDelete.length > 0) {
      await batchDelete_(reqTable, reqsToDelete);
    }

    console.log(`  ✓ Deleted ${tasksToDelete.length} tasks, ${reqsToDelete.length} requirements`);
  } else if (runAction === "found_existing" && dryRun) {
    console.log("");
    console.log("Phase 8: [DRY RUN] Would delete existing tasks and requirements");
  }

  // PHASE 9: Generate tasks
  console.log("");
  console.log("Phase 9: Generating prep tasks...");

  const tasksByItemId = {};
  const requiredQtyByItemId = {};
  const scheduledOutByItemId = {};
  const queue = [];

  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  function upsertTask(itemId, recipeId, targetQty, yieldQty) {
    const y = yieldQty || 1;
    tasksByItemId[itemId] = {
      itemId,
      recipeId,
      targetQty,
      yieldQty: y,
      batchesNeeded: round3(targetQty / y),
    };
  }

  function scheduleOutput(itemId, deltaOutQty) {
    if (deltaOutQty <= 0) return;
    scheduledOutByItemId[itemId] = (scheduledOutByItemId[itemId] || 0) + deltaOutQty;
    queue.push({ itemId, deltaOutQty });
  }

  // Top-level batches
  for (const itemRec of itemsQuery.records) {
    const itemId = itemRec.id;
    if (!itemActiveById[itemId]) continue;
    if (!CONFIG.allowedTopLevelItemTypes.has(itemTypeById[itemId])) continue;

    const shortfall = (par[itemId] || 0) - (onHand[itemId] || 0);
    if (shortfall <= 0) continue;

    const recipeInfo = recipeByProducedItem[itemId];
    upsertTask(itemId, recipeInfo?.recipeId || null, shortfall, recipeInfo?.yieldQty || 1);
    scheduleOutput(itemId, shortfall);
  }

  console.log(`  → Created ${Object.keys(tasksByItemId).length} top-level batch tasks`);

  // Cascade sub-recipes (Pass 1)
  // Purpose: fully accumulate requiredQtyByItemId for all components so that
  // sub-recipes shared across multiple parent batches receive the total combined
  // demand before their tasks are written.
  //
  // During queue processing we DO call scheduleOutput for sub-recipes so that
  // their own sub-sub-recipe ingredients are also cascaded. We do NOT call
  // upsertTask here — that is deferred to Pass 2 after the queue drains.
  let ops = 0;
  while (queue.length) {
    ops += 1;
    if (ops > CONFIG.maxQueueOps) throw new Error(`Exceeded maxQueueOps (${CONFIG.maxQueueOps}). Possible cyclic recipe dependency.`);

    const { itemId, deltaOutQty } = queue.shift();
    const recipeInfo = recipeByProducedItem[itemId];
    if (!recipeInfo) continue;

    const yieldQty = recipeInfo.yieldQty || 1;
    const scale = deltaOutQty / yieldQty;

    const lines = linesByRecipeId[recipeInfo.recipeId] || [];
    for (const line of lines) {
      const compId = line.componentId;
      const compType = itemTypeById[compId];

      const incQty = line.qtyPerBatch * scale;
      requiredQtyByItemId[compId] = (requiredQtyByItemId[compId] || 0) + incQty;

      if (CONFIG.subRecipeItemTypes.has(compType)) {
        if (!itemActiveById[compId]) continue;

        const demand = requiredQtyByItemId[compId] || 0;
        const hand = onHand[compId] || 0;

        const totalToMake = demand - hand;
        if (totalToMake <= 0) continue;

        const alreadyScheduled = scheduledOutByItemId[compId] || 0;
        const additional = totalToMake - alreadyScheduled;
        if (additional <= 0) continue;

        // Schedule output so sub-sub-recipe demand continues to cascade.
        // Do NOT call upsertTask here — demand may not be fully settled yet
        // because other parent recipes further in the queue may add more
        // demand to this same sub-recipe. upsertTask is called in Pass 2.
        scheduleOutput(compId, additional);
      }
    }
  }

  // Pass 2: Finalize sub-recipe tasks with fully-settled demand.
  // Now that the queue is drained all parent contributions to
  // requiredQtyByItemId have been accumulated. We create/overwrite the task
  // for every sub-recipe item that has positive net demand.
  for (const compId of Object.keys(requiredQtyByItemId)) {
    const compType = itemTypeById[compId];
    if (!CONFIG.subRecipeItemTypes.has(compType)) continue;
    if (!itemActiveById[compId]) continue;

    const demand = requiredQtyByItemId[compId] || 0;
    const hand = onHand[compId] || 0;
    const demandBased = demand - hand;

    // Also consider the par-based shortfall so items with their own par levels
    // are never under-produced just because parent demand is low.
    const parBased = (par[compId] || 0) - hand;
    const totalToMake = Math.max(demandBased, parBased);
    if (totalToMake <= 0) continue;

    const subRecipeInfo = recipeByProducedItem[compId];
    upsertTask(compId, subRecipeInfo?.recipeId || null, totalToMake, subRecipeInfo?.yieldQty || 1);
  }

  const allTasks = Object.values(tasksByItemId);
  console.log(`  → Total tasks after cascading: ${allTasks.length}`);

  // PHASE 10: Create tasks with Buffer Multiplier suggestions
  console.log("");
  console.log("Phase 10: Creating task records...");

  if (!dryRun) {
    const taskCreates = allTasks.map((t) => {
      const fields = {
        [CONFIG.taskRunField]: [{ id: runId }],
        [CONFIG.taskItemToProduceField]: [{ id: t.itemId }],
        [CONFIG.taskTargetQtyField]: t.targetQty,
        [CONFIG.taskBatchesNeededField]: t.batchesNeeded,
      };

      if (t.recipeId) {
        fields[CONFIG.taskRecipeUsedField] = [{ id: t.recipeId }];
      }

      // NEW: Calculate Suggested Qty only for Sub Recipe items
      const itemType = itemTypeById[t.itemId];
      if (CONFIG.subRecipeItemTypes.has(itemType)) {
        const buffer = itemBufferById[t.itemId] || 1.0;
        const suggestedQty = round3(t.targetQty * buffer);
        
        const suggestedField = safeField_(tasksTable, CONFIG.taskSuggestedQtyField);
        if (suggestedField) {
          fields[CONFIG.taskSuggestedQtyField] = suggestedQty;
        }
      }

      return { fields };
    });

    await batchCreate_(tasksTable, taskCreates);
    console.log(`  ✓ Created ${taskCreates.length} task records`);
  } else {
    console.log(`  → [DRY RUN] Would create ${allTasks.length} task records`);
  }

  // PHASE 11: Create ingredient requirements
  console.log("");
  console.log("Phase 11: Generating ingredient requirements...");

  const requiredTotals = {};
  for (const t of allTasks) {
    if (!t.recipeId) continue;

    const targetQty = typeof t.targetQty === "number" ? t.targetQty : 0;
    if (targetQty <= 0) continue;

    const yieldQty = t.yieldQty || 1;
    const scale = CONFIG.scaleRecipesExactly ? targetQty / yieldQty : Math.ceil(targetQty / yieldQty);

    const lines = linesByRecipeId[t.recipeId] || [];
    for (const line of lines) {
      const compId = line.componentId;
      const compType = itemTypeById[compId];

      const isIngredient = compType === CONFIG.ingredientItemType;
      const isSubRecipe = CONFIG.subRecipeItemTypes.has(compType);

      if (!isIngredient && !(CONFIG.includeSubRecipesInRequirements && isSubRecipe)) continue;
      if (isSubRecipe && !CONFIG.includeSubRecipesEvenIfProduced && tasksByItemId[compId]) continue;

      const qty = line.qtyPerBatch * scale;
      if (!requiredTotals[t.recipeId]) requiredTotals[t.recipeId] = {};
      requiredTotals[t.recipeId][compId] = (requiredTotals[t.recipeId][compId] || 0) + qty;
    }
  }

  const reqCreates = [];
  for (const [recipeId, itemsMap] of Object.entries(requiredTotals)) {
    for (const [itemId, qty] of Object.entries(itemsMap)) {
      const meta = itemMetaById[itemId] || { supplierIds: [], supplierName: "", category: "", orderingStaff: "" };

      const fields = {
        [CONFIG.reqRunField]: [{ id: runId }],
        [CONFIG.reqRecipeField]: [{ id: recipeId }],
        [CONFIG.reqItemNeededField]: [{ id: itemId }],
        [CONFIG.reqTotalQtyField]: qty,
      };

      setSingleSupplierLinkIfPossible_(fields, reqTable, CONFIG.reqSupplierLinkStaticField, meta.supplierIds);
      setTextOrSelectField_(fields, reqTable, CONFIG.reqSupplierNameStaticField, meta.supplierName);
      setTextOrSelectField_(fields, reqTable, CONFIG.reqProductCategoryStaticField, meta.category);
      setTextOrSelectField_(fields, reqTable, CONFIG.reqOrderingStaffStaticField, meta.orderingStaff);

      reqCreates.push({ fields });
    }
  }

  if (!dryRun && reqCreates.length > 0) {
    await batchCreate_(reqTable, reqCreates);
    console.log(`  ✓ Created ${reqCreates.length} ingredient requirements`);
  } else if (dryRun && reqCreates.length > 0) {
    console.log(`  → [DRY RUN] Would create ${reqCreates.length} requirements`);
  }

  // PHASE 12: Capture user
  console.log("");
  console.log("Phase 12: Capturing user info...");
  
  let user = "(Unknown)";
  if (!dryRun) {
    user = await getUserFromModifiedRecords_(tasksTable, 5);
    console.log(`  → User: ${user}`);
  } else {
    user = "(Dry Run - no user capture)";
    console.log(`  → ${user}`);
  }

  // PHASE 13: Calculate execution time
  const endTime = Date.now();
  const executionTime = ((endTime - startTime) / 1000).toFixed(2);

  // PHASE 14: Update request status
  if (shouldTrackRequest) {
    await safeUpdateRequest_(requestsTable, requestIdInput, {
      statusName: "Done",
      runId: runId !== "DRY_RUN" ? runId : null,
      finishedAt: new Date(),
      errorText: "",
      stocktakeDate: latestCountDate,
    });
  }

  // PHASE 15: Summary
  console.log("");
  console.log("========================================");
  console.log("✓ GENERATE PREP RUN - Complete");
  console.log("========================================");
  console.log(`Execution time: ${executionTime}s`);
  console.log(`Prep Run: ${runId}`);
  console.log(`Action: ${runAction}`);
  console.log(`Tasks Created: ${allTasks.length}`);
  console.log(`Requirements Created: ${reqCreates.length}`);
  console.log(`Stocktake: ${formatSydneyDDMMYYYYHHMM_(latestCountDate)}`);
  console.log("");

  // PHASE 16: Write audit log
  const configUsed = JSON.stringify({
    dryRun,
    allowDuplicates,
    scaleRecipesExactly: CONFIG.scaleRecipesExactly,
    includeSubRecipesInRequirements: CONFIG.includeSubRecipesInRequirements,
  }, null, 2);

  const message = dryRun
    ? `[DRY RUN] Would create ${allTasks.length} tasks, ${reqCreates.length} requirements`
    : `Created ${allTasks.length} tasks, ${reqCreates.length} requirements (action: ${runAction})`;

  const details = 
    `Stocktake Date: ${formatSydneyDDMMYYYYHHMM_(latestCountDate)}\n` +
    `Stocktake ISO: ${latestCountDate.toISOString()}\n` +
    `Stocktake Key: ${stocktakeMinuteIso}\n` +
    `Prep Run ID: ${runId}\n` +
    `Run Action: ${runAction}\n` +
    `Batch Tasks: ${allTasks.filter(t => itemTypeById[t.itemId] === "Batch").length}\n` +
    `Sub-recipe Tasks: ${allTasks.filter(t => CONFIG.subRecipeItemTypes.has(itemTypeById[t.itemId])).length}\n` +
    `Total Tasks: ${allTasks.length}\n` +
    `Ingredient Requirements: ${reqCreates.length}\n` +
    `Mode: ${dryRun ? "DRY RUN" : "LIVE"}`;

  const auditEntry = {
    scriptName: CONFIG.scriptName,
    status: "SUCCESS",
    message,
    details,
    user,
    executionTime: parseFloat(executionTime),
    configUsed,
    relatedRunId: runId !== "DRY_RUN" ? runId : null,
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
  output.set("runId", runId);
  output.set("runAction", runAction);
  output.set("tasksCreated", allTasks.length);
  output.set("requirementsCreated", reqCreates.length);
  output.set("stocktakeDateIso", latestCountDate.toISOString());
  output.set("stocktakeKey", stocktakeMinuteIso);
  output.set("status", "success");
  output.set("executionTime", executionTime);
  output.set("user", user);
}

// Execute with error handling
(async () => {
  const startTime = Date.now();
  const requestsTable = requestIdInput ? safeGetTable_(CONFIG.requestsTableName) : null;
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
    console.log("❌ GENERATE PREP RUN - FAILED");
    console.log("========================================");
    console.log(`Error: ${errorMessage}`);
    console.log(`Execution time: ${executionTime}s`);
    console.log("");

    // Update request status if applicable
    if (requestsTable && requestIdInput) {
      await safeUpdateRequest_(requestsTable, requestIdInput, {
        statusName: "Failed",
        errorText: errorMessage,
        finishedAt: new Date(),
      });
    }

    // Write error to audit log
    if (!dryRun && auditLogTable) {
      try {
        const configUsed = JSON.stringify({
          dryRun,
          allowDuplicates,
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