/****************************************************
 * INTEGRATED PREP → GOOGLE DOCS EXPORTER (4 DOCS + SLACK)
 * VERSION 4.2 — HYBRID TEMPLATE ENGINE
 *
 * CHANGES IN v4.2:
 * - HYBRID APPROACH: Templates for branding, code for content
 * - Templates now only need header styling + {{CONTENT}} marker
 * - All dynamic content (loops, nested data) handled programmatically
 * - Fixes nested loop limitation in Google Docs API
 * - Reliable content generation with branded headers
 *
 * CHANGES IN v4.1:
 * - Element-based template engine (attempted nested loops)
 * - Bold/underline quantity formatting
 *
 * CHANGES IN v4.0:
 * - Template-based document generation with branded styling
 * - Falls back to programmatic generation if templates missing
 *
 * CHANGES IN v3.0:
 * - 1.5x buffer multiplier applied to ALL ingredients and batches
 * - Buffer format: "3862.07ml (1.5x = 5793.10ml)"
 *
 * TEMPLATE FORMAT (v4.2):
 * Templates should contain:
 * - Header with logo, branding, styling
 * - Placeholders: {{DATE}}, {{RUN_LABEL}}, {{STAFF_NAME}}
 * - A {{CONTENT}} marker where dynamic content will be inserted
 * - Any footer elements
 *
 * Monday AM Outputs (2 Docs — ordering suppressed):
 * 1) Ingredient Prep Run Sheet (Sub Recipe tasks grouped by Batch)
 * 2) Batching Run Sheet (Batch tasks with ingredient bullets + method)
 *
 * Manual Trigger Output (1 Doc — after bar stock count):
 * 3) Ordering Run Sheet (Combined bar stock + prep-only ordering, grouped by supplier)
 *
 * REQUIRED SCRIPT PROPERTIES:
 * - AIRTABLE_BASE_ID
 * - AIRTABLE_PAT
 * - DOCS_FOLDER_ID
 * - SLACK_WEBHOOK_PREP
 * - SLACK_WEBHOOK_WARATAH_TEST (test channel — combined ordering notification)
 * - MANUAL_TRIGGER_SECRET (for webhook triggers)
 * - RECIPE_SCALER_URL (optional, deployed web app URL for Recipe Scaler)
 * - WARATAH_TEMPLATE_ORDERING_ID (optional, for branded combined ordering template)
 * - TEMPLATE_BATCHING_ID (optional, for branded templates)
 * - TEMPLATE_INGREDIENT_PREP_ID (optional, for branded templates)
 ****************************************************/

const CFG = {
  timezone: "Australia/Sydney",

  props: {
    airtableBaseId: "AIRTABLE_BASE_ID",
    airtablePat: "AIRTABLE_PAT",
    docsFolderId: "DOCS_FOLDER_ID",

    slackPrep: "SLACK_WEBHOOK_PREP",
    slackWaratahTest: "SLACK_WEBHOOK_WARATAH_TEST",
    manualTriggerSecret: "MANUAL_TRIGGER_SECRET",
    recipeScalerUrl: "RECIPE_SCALER_URL",

    templateOrderingCombined: "WARATAH_TEMPLATE_ORDERING_ID",
    templateBatching: "WARATAH_TEMPLATE_BATCHING_ID",
    templateIngredientPrep: "WARATAH_TEMPLATE_INGREDIENT_PREP_ID",
    feedbackFormUrl: "FEEDBACK_FORM_URL",
  },

  airtable: {
    tables: {
      runs: "Prep Runs",
      tasks: "Prep Tasks",
      reqs: "Ingredient Requirements",
      items: "Items",
      recipes: "Recipes",
      recipeLines: "Recipe Lines",
      supplier: "Supplier",
      parLevels: "Par Levels",           // ⚠️ TABLE NAME ASSUMED — verify against Airtable base
      weeklyCounts: "Weekly Counts",     // ⚠️ TABLE NAME ASSUMED — verify against Airtable base
      stockOrders: "Stock Orders",
      countSessions: "Count Sessions",
    },

    fields: {
      runPrepWeek: "Prep Week",
      runNotes: "Notes / Handover Notes",
      runLinkToGuides: "Link to Prep Guides",
      runTasksLinkBack: "Prep Tasks",
      runReqsLinkBack: "Ingredient Requirements",

      taskItem: "Item Needed",
      taskRecipe: "Recipe Used",
      taskTarget: "Target Qty",
      taskBatches: "Batches Needed",
      taskSuggestedQty: "Suggested Qty (Buffer)",
      taskNotes: "Notes",

      reqItem: "Item Link",
      reqQty: "Total Qty Needed",
      reqSupplierNameStatic: "Supplier Name (Static)",
      reqStaffStatic: "Ordering Staff (Static)",
      reqSupplierLink: "Supplier",
      reqOrderingStaff: "Ordering Staff",

      itemName: "Item Name",
      itemType: "Item Type",
      itemUnit: "Unit",

      recipeName: "Recipe Name",
      recipeMethod: "Method",

      rlRecipe: "Recipe",
      rlItem: "Item",
      rlQty: "Qty",

      // Par Levels table fields
      // ⚠️ FIELD NAMES ASSUMED — verify against Airtable base
      parItem: "Item Link",   // linked record field pointing to Items table
      parQty: "Prep Qty",     // numeric par quantity

      // Weekly Counts table fields
      // ⚠️ FIELD NAMES ASSUMED — verify against Airtable base
      wcItem: "Item",              // linked record field pointing to Items table
      wcStockCount: "Stock Count", // numeric stock on hand
      wcConfirmed: "Confirmed",    // checkbox — true when count is verified
      wcCountDate: "Count Date",   // date field for recency resolution

      supplierName: "Supplier Name",
      supplierOrderingStaff: "Ordering Staff",
      supplierEmail: "Email",

      // Stock Orders fields (populated by Waratah_GenerateStockOrders.gs)
      soItem: "Item",                          // linked record → Items
      soSession: "Count Session",              // linked record → Count Sessions
      soOnHand: "Total On Hand",
      soPrepUsage: "Prep Usage",
      soParQty: "Prep Qty",
      soServiceShortfall: "Service Shortfall",
      soCombinedQty: "Combined Order Qty",
      soSupplierStatic: "Supplier Name (Static)",
      soCategoryStatic: "Product Category (Static)",
      soStaffStatic: "Ordering Staff (Static)",
      soStatus: "Status",

      // Count Sessions fields
      csStatus: "Status",
      csDate: "Session Date",
      csName: "Session Name",
      csCountedBy: "Counted By",
      csOrderingExportState: "Ordering Export State",  // Single select: REQUESTED / COMPLETED / ERROR

      // Items — Bar Stock flag (used by combined ordering to identify prep-only items)
      itemBarStock: "Bar Stock",
    },

    itemTypes: {
      batch: "Batch",           // Batching List only
      subRecipe: "Sub Recipe",  // Ingredient Prep List only
      subRecipeVariants: new Set(["Sub-recipe"]),
      // Both "Batch" and "Sub Recipe" items appear in the Batching List + Ingredient Prep List docs.
      // Used in ordering filter to skip in-house items.
      batchVariants: new Set(["Batch", "Sub Recipe"]),
      // Garnish and Other items appear in the Ingredient Prep List (not Batching List, not ordering).
      ingredientPrepOnly: new Set(["Garnish", "Other"]),
    },

  },

  bufferMultiplier: 1.5,
};

let SLACK_WEBHOOK_OVERRIDE = null;
let RUN_ID_OVERRIDE = null;
let SKIP_SLACK = false;

/* =========================================================
 * WEB APP ROUTER (doGet)
 * Routes to either Feedback Form or Recipe Scaler based on 'page' parameter
 * ======================================================= */

/**
 * Unified doGet router for web app deployments
 * Routes based on 'page' URL parameter:
 * - page=scaler → Recipe Scaler
 * - page=feedback (or default) → Feedback Form
 *
 * @param {Object} e - Event object with URL parameters
 * @returns {HtmlOutput} - The appropriate HTML page
 */
function doGet(e) {
  const page = (e.parameter.page || 'feedback').toLowerCase();

  if (page === 'scaler') {
    return doGetRecipeScaler(e);
  } else {
    return doGetFeedback(e);
  }
}

/* =========================================================
 * WEB APP ENDPOINT (doPost)
 * ======================================================= */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};

    const secret = String(body.secret || "");
    const expected = getProp_(CFG.props.manualTriggerSecret);

    if (!secret || secret !== expected) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: "unauthorised" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = String(body.action || "export").toLowerCase();

    // ── Combined ordering doc (manual trigger after bar stock count) ──
    if (action === "ordering") {
      const notifySlack = body.notifySlack !== false;
      SKIP_SLACK = !notifySlack;
      try {
        const result = exportCombinedOrderingDoc_();
        return ContentService
          .createTextOutput(JSON.stringify({ ok: true, action: "ordering", result }))
          .setMimeType(ContentService.MimeType.JSON);
      } finally {
        SKIP_SLACK = false;
      }
    }

    // ── Standard prep export (Monday AM automation) ──
    const runId = body.runId || null;
    const mode = String(body.mode || "LIVE").toUpperCase();
    const notifySlack = body.notifySlack !== false;

    const result =
      mode === "TEST"
        ? exportPrepRunToDocsForRunId_(runId, { test: true, notifySlack })
        : exportPrepRunToDocsForRunId_(runId, { test: false, notifySlack });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * PUBLIC FUNCTIONS
 * ======================================================= */


function exportPrepRunToDocsForRunId_(runId, { test = false, notifySlack = true } = {}) {
  RUN_ID_OVERRIDE = runId || null;
  SKIP_SLACK = !notifySlack;

  try {
    return test ? exportLatestPrepRunToDocs_TEST() : exportLatestPrepRunToDocs();
  } finally {
    RUN_ID_OVERRIDE = null;
    SKIP_SLACK = false;
  }
}

function exportLatestPrepRunToDocs() {
  const run = RUN_ID_OVERRIDE ? getRunById_(RUN_ID_OVERRIDE) : getLatestRunWithData_();
  if (!run) throw new Error("No Prep Run found (or no runs have tasks/requirements linked).");

  const runLabel = formatRunLabel_(run);
  const runDateFormatted = formatRunDateLong_(run);
  const weekEnding = formatWeekEndingLabel_(run);

  const rootFolder = DriveApp.getFolderById(getDocsFolderId_());
  const folderName = `Prep Run ${runLabel}`;

  const existing = rootFolder.getFoldersByName(folderName);
  const runFolder = existing.hasNext() ? existing.next() : rootFolder.createFolder(folderName);

  setRunFolderSharing_(runFolder);

  const taskIds = Array.isArray(run.fields[CFG.airtable.fields.runTasksLinkBack])
    ? run.fields[CFG.airtable.fields.runTasksLinkBack]
    : [];
  const reqIds = Array.isArray(run.fields[CFG.airtable.fields.runReqsLinkBack])
    ? run.fields[CFG.airtable.fields.runReqsLinkBack]
    : [];

  const tasks = taskIds.length
    ? airtableGetByIds_(CFG.airtable.tables.tasks, taskIds, [
        CFG.airtable.fields.taskItem,
        CFG.airtable.fields.taskRecipe,
        CFG.airtable.fields.taskTarget,
        CFG.airtable.fields.taskBatches,
        CFG.airtable.fields.taskSuggestedQty,
        CFG.airtable.fields.taskNotes,
      ])
    : [];

  const reqs = reqIds.length
    ? airtableGetByIds_(CFG.airtable.tables.reqs, reqIds, [
        CFG.airtable.fields.reqItem,
        CFG.airtable.fields.reqQty,
        CFG.airtable.fields.reqSupplierNameStatic,
        CFG.airtable.fields.reqStaffStatic,
        CFG.airtable.fields.reqSupplierLink,
        CFG.airtable.fields.reqOrderingStaff,
      ])
    : [];

  const itemIds = new Set();
  const recipeIds = new Set();
  const supplierIds = new Set();

  tasks.forEach((t) => {
    const itemId = firstId_(t.fields[CFG.airtable.fields.taskItem]);
    if (itemId) itemIds.add(itemId);
    const recipeId = firstId_(t.fields[CFG.airtable.fields.taskRecipe]);
    if (recipeId) recipeIds.add(recipeId);
  });

  reqs.forEach((r) => {
    const itemId = firstId_(r.fields[CFG.airtable.fields.reqItem]);
    if (itemId) itemIds.add(itemId);
    const supId = firstId_(r.fields[CFG.airtable.fields.reqSupplierLink]);
    if (supId) supplierIds.add(supId);
  });

  const itemsById = itemIds.size
    ? indexById_(
        airtableGetByIds_(CFG.airtable.tables.items, Array.from(itemIds), [
          CFG.airtable.fields.itemName,
          CFG.airtable.fields.itemType,
          CFG.airtable.fields.itemUnit,
        ])
      )
    : {};

  const recipesById = recipeIds.size
    ? indexById_(
        airtableGetByIds_(CFG.airtable.tables.recipes, Array.from(recipeIds), [
          CFG.airtable.fields.recipeMethod,
        ])
      )
    : {};

  const suppliersById = supplierIds.size
    ? indexById_(
        airtableGetByIds_(CFG.airtable.tables.supplier, Array.from(supplierIds), [
          CFG.airtable.fields.supplierName,
          CFG.airtable.fields.supplierOrderingStaff,
          CFG.airtable.fields.supplierEmail,
        ])
      )
    : {};

  const linesByRecipeId = getRecipeLinesByRecipeId_(recipeIds);

  // Collect ingredient item IDs referenced in recipe lines that weren't fetched as task items
  const lineItemIds = new Set();
  Object.values(linesByRecipeId).forEach((lines) => {
    lines.forEach((ln) => {
      if (!itemsById[ln.itemId]) lineItemIds.add(ln.itemId);
    });
  });
  if (lineItemIds.size) {
    const lineItems = airtableGetByIds_(CFG.airtable.tables.items, Array.from(lineItemIds), [
      CFG.airtable.fields.itemName,
      CFG.airtable.fields.itemType,
      CFG.airtable.fields.itemUnit,
    ]);
    lineItems.forEach((item) => { itemsById[item.id] = item; });
  }

  // ---------------------------------------------------------------------------
  // Fetch Par Levels: build { [itemId]: parQty }
  // ---------------------------------------------------------------------------
  const parQtyByItemId = {};
  try {
    const parRecs = airtableListAll_(CFG.airtable.tables.parLevels, {
      fields: [CFG.airtable.fields.parItem, CFG.airtable.fields.parQty],
      pageSize: 100,
    });
    parRecs.forEach((rec) => {
      const itemId = firstId_(rec.fields[CFG.airtable.fields.parItem]);
      const qty = num_(rec.fields[CFG.airtable.fields.parQty]);
      if (itemId && Number.isFinite(qty)) {
        parQtyByItemId[itemId] = qty;
      }
    });
    Logger.log(`Par Levels fetched: ${Object.keys(parQtyByItemId).length} records`);
  } catch (e) {
    Logger.log(`WARNING: Could not fetch Par Levels — ${e.message}. Continuing without par data.`);
  }

  // ---------------------------------------------------------------------------
  // Fetch Weekly Counts (Confirmed only): build { [itemId]: onHandQty }
  // Use most-recent confirmed count per item when multiple exist.
  // ---------------------------------------------------------------------------
  const onHandByItemId = {};
  try {
    const wcRecs = airtableListAll_(CFG.airtable.tables.weeklyCounts, {
      fields: [
        CFG.airtable.fields.wcItem,
        CFG.airtable.fields.wcStockCount,
        CFG.airtable.fields.wcConfirmed,
        CFG.airtable.fields.wcCountDate,
      ],
      filterByFormula: `{${CFG.airtable.fields.wcConfirmed}}=TRUE()`,
      pageSize: 100,
    });
    // Track latest count date per item so we always use the most recent
    const latestDateByItemId = {};
    wcRecs.forEach((rec) => {
      const itemId = firstId_(rec.fields[CFG.airtable.fields.wcItem]);
      if (!itemId) return;
      const qty = num_(rec.fields[CFG.airtable.fields.wcStockCount]);
      const dateStr = rec.fields[CFG.airtable.fields.wcCountDate] || rec.createdTime || "";
      const ts = dateStr ? new Date(dateStr).getTime() : 0;
      if (!(itemId in latestDateByItemId) || ts > latestDateByItemId[itemId]) {
        latestDateByItemId[itemId] = ts;
        onHandByItemId[itemId] = Number.isFinite(qty) ? qty : 0;
      }
    });
    Logger.log(`Weekly Counts fetched: ${Object.keys(onHandByItemId).length} confirmed records`);
  } catch (e) {
    Logger.log(`WARNING: Could not fetch Weekly Counts — ${e.message}. Continuing without stock data.`);
  }

  const batchTasks = [];      // "Batch" type → Batching List only
  const subRecipeTasks = [];  // "Sub Recipe" type → Ingredient Prep List only
  const subTasksByItemId = {};

  tasks.forEach((t) => {
    const itemId = firstId_(t.fields[CFG.airtable.fields.taskItem]);
    if (!itemId || !itemsById[itemId]) return;

    const item = itemsById[itemId];
    const itemName = String(item.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim();
    const unit = cellToText_(item.fields[CFG.airtable.fields.itemUnit]);
    const itemType = normaliseItemType_(cellToText_(item.fields[CFG.airtable.fields.itemType]));

    const recipeId = firstId_(t.fields[CFG.airtable.fields.taskRecipe]);
    const recipe = recipeId ? recipesById[recipeId] : null;

    const taskObj = {
      taskId: t.id,
      itemId,
      itemName,
      itemType,
      unit,
      targetQty: num_(t.fields[CFG.airtable.fields.taskTarget]),
      batchesNeeded: num_(t.fields[CFG.airtable.fields.taskBatches]),
      suggestedQty: num_(t.fields[CFG.airtable.fields.taskSuggestedQty]),
      recipeId: recipeId || null,
      // Waratah Recipes table has no "Recipe Name" plain-text field — recipes are identified
      // by their linked Item Name. itemName (resolved above from itemsById) is the correct
      // recipe name. CFG.airtable.fields.recipeName ("Recipe Name") does not exist in Waratah
      // and silently returns blank from Airtable REST API.
      recipeName: itemName,
      method: recipe ? (recipe.fields[CFG.airtable.fields.recipeMethod] || "") : "",
      notes: (t.fields[CFG.airtable.fields.taskNotes] || "").trim(),
    };

    if (itemType === CFG.airtable.itemTypes.batch) {
      batchTasks.push(taskObj);
    } else if (itemType === CFG.airtable.itemTypes.subRecipe) {
      subRecipeTasks.push(taskObj);
    } else if (CFG.airtable.itemTypes.subRecipeVariants.has(itemType)) {
      subTasksByItemId[itemId] = taskObj;
    } else if (CFG.airtable.itemTypes.ingredientPrepOnly.has(itemType)) {
      // Garnish and Other items appear in the Ingredient Prep List
      subRecipeTasks.push(taskObj);
    }
  });

  // Filter out tasks with no meaningful target quantity
  const filteredBatchTasks = batchTasks.filter(t =>
    Number.isFinite(t.targetQty) && t.targetQty > 0
  );
  filteredBatchTasks.sort((a, b) => a.itemName.localeCompare(b.itemName));

  const filteredSubRecipeTasks = subRecipeTasks.filter(t =>
    Number.isFinite(t.targetQty) && t.targetQty > 0
  );
  filteredSubRecipeTasks.sort((a, b) => a.itemName.localeCompare(b.itemName));

  // Also filter subTasks
  Object.keys(subTasksByItemId).forEach(key => {
    const task = subTasksByItemId[key];
    if (!Number.isFinite(task.targetQty) || task.targetQty <= 0) {
      delete subTasksByItemId[key];
    }
  });

  // ---------------------------------------------------------------------------
  // Build parent batch map: subRecipeItemId → { names: string[], totalTargetQty: number }
  // Each entry accumulates ALL parent batch names and the SUM of their targetQty values.
  // Tier-2 nesting: also walk into sub-recipe recipe lines so items nested under sub-recipes
  // (whose parent sub-recipe is itself a child of a batch) are linked back to the top-level batch.
  // ---------------------------------------------------------------------------
  const subRecipeItemIdToParentBatch = {};

  function recordParentBatch_(childItemId, batchTask) {
    if (!subRecipeItemIdToParentBatch[childItemId]) {
      subRecipeItemIdToParentBatch[childItemId] = { names: [], totalTargetQty: 0 };
    }
    const entry = subRecipeItemIdToParentBatch[childItemId];
    if (!entry.names.includes(batchTask.itemName)) {
      entry.names.push(batchTask.itemName);
      entry.totalTargetQty += (batchTask.targetQty || 0);
    }
  }

  filteredBatchTasks.forEach((batchTask) => {
    if (!batchTask.recipeId) return;
    const tier1Lines = linesByRecipeId[batchTask.recipeId] || [];
    tier1Lines.forEach((ln) => {
      const comp = itemsById[ln.itemId];
      if (!comp) return;
      const compType = normaliseItemType_(cellToText_(comp.fields[CFG.airtable.fields.itemType]));
      const isSubRecipe =
        compType === CFG.airtable.itemTypes.subRecipe ||
        CFG.airtable.itemTypes.subRecipeVariants.has(compType);
      if (!isSubRecipe) return;
      // Tier 1: direct sub-recipe child of this batch
      recordParentBatch_(ln.itemId, batchTask);
      // Tier 2: walk into the sub-recipe's own recipe lines to find deeper nested sub-recipes
      const subRecipeTask = subTasksByItemId[ln.itemId] || filteredSubRecipeTasks.find(function(t) { return t.itemId === ln.itemId; });
      const subRecipeId = subRecipeTask ? subRecipeTask.recipeId : null;
      if (subRecipeId) {
        const tier2Lines = linesByRecipeId[subRecipeId] || [];
        tier2Lines.forEach((ln2) => {
          const comp2 = itemsById[ln2.itemId];
          if (!comp2) return;
          const comp2Type = normaliseItemType_(cellToText_(comp2.fields[CFG.airtable.fields.itemType]));
          const isSub2 =
            comp2Type === CFG.airtable.itemTypes.subRecipe ||
            CFG.airtable.itemTypes.subRecipeVariants.has(comp2Type);
          if (!isSub2) return;
          recordParentBatch_(ln2.itemId, batchTask);
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Enrich all task arrays with par/stock data
  // ---------------------------------------------------------------------------
  const allTaskArrays = [filteredBatchTasks, filteredSubRecipeTasks, Object.values(subTasksByItemId)];
  allTaskArrays.forEach((arr) => {
    arr.forEach((task) => {
      task.parQty = parQtyByItemId[task.itemId] !== undefined ? parQtyByItemId[task.itemId] : 0;
      task.onHand = onHandByItemId[task.itemId] !== undefined ? onHandByItemId[task.itemId] : 0;
      const parentBatchEntry = subRecipeItemIdToParentBatch[task.itemId];
      task.parentBatchNames = parentBatchEntry ? parentBatchEntry.names : [];
      task.parentBatchTargetQty = parentBatchEntry ? parentBatchEntry.totalTargetQty : 0;
    });
  });

  const ingredientTitle = `Ingredient Prep Run Sheet ${weekEnding}`;
  const batchingTitle   = `Batching Run Sheet ${weekEnding}`;

  const ingredientDocId = createIngredientPrepDoc_(
    runFolder, ingredientTitle, runDateFormatted, runLabel,
    filteredSubRecipeTasks, subTasksByItemId, linesByRecipeId, itemsById,
    run.id
  );

  const batchingDocId = createBatchingDoc_(
    runFolder, batchingTitle, runDateFormatted, runLabel,
    filteredBatchTasks, linesByRecipeId, itemsById,
    run.id
  );

  // ── Ordering docs SUPPRESSED from Monday AM export ──
  // Combined ordering doc is generated separately via manual trigger (action=ordering)
  // after bar stock count is completed and Stock Orders are generated.
  // See exportCombinedOrderingDoc_() below.

  const runFolderUrl = runFolder.getUrl();

  airtablePatch_(CFG.airtable.tables.runs, run.id, {
    [CFG.airtable.fields.runLinkToGuides]: runFolderUrl,
  });

  postPrepRunToSlack_({
    runLabel,
    ingredientDoc: { title: ingredientTitle, url: docUrl_(ingredientDocId) },
    batchingDoc: { title: batchingTitle, url: docUrl_(batchingDocId) },
  });

  const result = {
    runId: run.id,
    runLabel,
    folderUrl: runFolderUrl,
    docs: {
      ingredient: { title: ingredientTitle, url: docUrl_(ingredientDocId) },
      batching: { title: batchingTitle, url: docUrl_(batchingDocId) },
    },
  };

  Logger.log("✅ Export complete");
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function exportLatestPrepRunToDocs_TEST() {
  SLACK_WEBHOOK_OVERRIDE = getSlackWebhook_(CFG.props.slackWaratahTest);
  try {
    return exportLatestPrepRunToDocs();
  } finally {
    SLACK_WEBHOOK_OVERRIDE = null;
  }
}

function exportCombinedOrderingDoc_TEST() {
  SLACK_WEBHOOK_OVERRIDE = getSlackWebhook_(CFG.props.slackWaratahTest);
  try {
    return exportCombinedOrderingDoc_();
  } finally {
    SLACK_WEBHOOK_OVERRIDE = null;
  }
}

/* =========================================================
 * HYBRID TEMPLATE ENGINE v4.2
 *
 * APPROACH:
 * - Templates provide: header branding, logo, styling
 * - Code provides: all dynamic content (suppliers, items, etc.)
 *
 * TEMPLATE FORMAT:
 * - Header section with {{DATE}}, {{RUN_LABEL}}, {{STAFF_NAME}}
 * - A {{CONTENT}} marker where dynamic content will be inserted
 * - Any footer/branding elements
 *
 * This hybrid approach avoids Google Docs API limitations with
 * nested loops while still allowing branded document templates.
 * ======================================================= */

function getOptionalProp_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v || !String(v).trim()) return null;
  return String(v).trim();
}

function templateExists_(templateId) {
  if (!templateId) return false;
  try {
    DriveApp.getFileById(templateId);
    return true;
  } catch (e) {
    Logger.log(`templateExists_: cannot access file "${templateId}" — ${e.message}`);
    return false;
  }
}

function copyTemplate_(templateId, folder, newName) {
  const templateFile = DriveApp.getFileById(templateId);
  const copy = templateFile.makeCopy(newName, folder);
  return DocumentApp.openById(copy.getId());
}

/**
 * Escape regex special characters
 */
function escapeRegex_(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace simple placeholders throughout the document (body, headers, footers)
 */
function replaceAllPlaceholders_(doc, data) {
  const body = doc.getBody();

  Object.keys(data).forEach((key) => {
    const placeholder = `{{${key}}}`;
    const value = String(data[key] || "");

    // Replace in body
    body.replaceText(escapeRegex_(placeholder), value);

    // Replace in headers
    const headers = doc.getHeader();
    if (headers) {
      headers.replaceText(escapeRegex_(placeholder), value);
    }

    // Replace in footers
    const footers = doc.getFooter();
    if (footers) {
      footers.replaceText(escapeRegex_(placeholder), value);
    }
  });
}

/**
 * Clean up any remaining placeholder markers and remove empty paragraphs left behind
 */
function cleanupMarkers_(body) {
  // First, aggressively remove any elements containing Mustache-style template markers
  // This handles templates that have full loop structures like {{#BATCHES}}...{{/BATCHES}}
  removeAllTemplateElements_(body);

  // Then clean up any remaining marker text
  const markerPattern = "\\{\\{[A-Za-z_#/0-9]+\\}\\}";
  body.replaceText(markerPattern, "");

  // Remove paragraphs that are now completely empty (likely from marker removal)
  // Work backwards to avoid index shifting issues
  const toRemove = [];
  const numChildren = body.getNumChildren();

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const text = child.asText().getText();
      // Only remove completely empty paragraphs (no text, no spaces)
      if (text === "") {
        toRemove.push(i);
      }
    }
  }

  // Remove in reverse order to maintain indices
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    // Keep at least one element in body
    if (body.getNumChildren() > 1) {
      try {
        body.removeChild(body.getChild(idx));
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

/**
 * Aggressively removes all elements containing Mustache-style template markers.
 * This handles templates with full loop structures ({{#SECTION}}...{{/SECTION}})
 */
function removeAllTemplateElements_(body) {
  // Patterns that indicate template placeholder content
  const templatePatterns = [
    "{{#",      // Start of loop/section
    "{{/",      // End of loop/section
    "{{BATCH",
    "{{INGREDIENT",
    "{{SUPPLIER",
    "{{ITEM",
    "{{METHOD",
    "{{STEP",
    "{{NOTES",
    "{{QTY",
    "{{PARENT",
    "{{SUB",
    "{{HAS_",
    "{{IS_",
    "{{UNASSIGNED",
    "INGREDIENTS",  // Template label text
    "METHOD",       // Template label text
  ];

  const toRemove = [];
  const numChildren = body.getNumChildren();

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    let shouldRemove = false;

    try {
      // For tables, check all cells
      if (child.getType() === DocumentApp.ElementType.TABLE) {
        const table = child.asTable();
        const numRows = table.getNumRows();

        for (let r = 0; r < numRows && !shouldRemove; r++) {
          const row = table.getRow(r);
          const numCells = row.getNumCells();

          for (let c = 0; c < numCells && !shouldRemove; c++) {
            const cellText = row.getCell(c).getText();
            for (const pattern of templatePatterns) {
              if (cellText.includes(pattern)) {
                shouldRemove = true;
                break;
              }
            }
          }
        }
      } else {
        // For other elements, check text directly
        const text = child.asText ? child.asText().getText() : "";
        for (const pattern of templatePatterns) {
          if (text.includes(pattern)) {
            shouldRemove = true;
            break;
          }
        }
      }

      if (shouldRemove) {
        toRemove.push(i);
      }
    } catch (e) {
      // Element doesn't support getText, skip
    }
  }

  // Remove in reverse order to maintain indices
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    if (body.getNumChildren() > 1) {
      try {
        body.removeChild(body.getChild(idx));
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

/**
 * Removes any paragraphs/elements containing specific text from the document body.
 * Used to clean up template placeholder content that should be code-generated.
 */
function removeElementsContainingText_(body, searchText) {
  const toRemove = [];
  const numChildren = body.getNumChildren();

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    try {
      const text = child.asText().getText();
      if (text.includes(searchText)) {
        toRemove.push(i);
      }
    } catch (e) {
      // Element doesn't support getText, skip
    }
  }

  // Remove in reverse order to maintain indices
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    if (body.getNumChildren() > 1) {
      try {
        body.removeChild(body.getChild(idx));
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

/* =========================================================
 * BATCHING DOC (TEMPLATE-FIRST)
 * ======================================================= */

function createBatchingDoc_(folder, title, dateFormatted, runLabel, batchTasks, linesByRecipeId, itemsById, runId) {
  const templateId = getOptionalProp_(CFG.props.templateBatching);
  const staffRole = "Prep Team";

  if (templateId && templateExists_(templateId)) {
    try {
      return createBatchingDocFromTemplate_(folder, title, dateFormatted, runLabel, batchTasks, linesByRecipeId, itemsById, templateId, runId, staffRole);
    } catch (e) {
      Logger.log(`Template processing failed for Batching doc: ${e.message}. Falling back to programmatic.`);
      Logger.log(e.stack);
    }
  } else {
    Logger.log("Template not found for Batching doc, using programmatic fallback.");
  }

  return createOrReplaceBatchingDoc_(folder, title, dateFormatted, batchTasks, linesByRecipeId, itemsById, runId, staffRole);
}

/**
 * HYBRID TEMPLATE: Batching List
 * Template provides: header branding
 * Code provides: batch content with ingredients and methods
 */
function createBatchingDocFromTemplate_(folder, title, dateFormatted, runLabel, batchTasks, linesByRecipeId, itemsById, templateId, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = copyTemplate_(templateId, folder, title);
  const body = doc.getBody();

  // Replace header placeholders
  replaceAllPlaceholders_(doc, {
    DATE: dateFormatted,
    RUN_LABEL: runLabel,
  });

  // Find and remove {{CONTENT}} marker
  const contentMarker = "{{CONTENT}}";
  const searchResult = body.findText(contentMarker);
  let insertIndex = body.getNumChildren();

  if (searchResult) {
    const element = searchResult.getElement();
    let parent = element.getParent();
    while (parent.getParent() && parent.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
      parent = parent.getParent();
    }
    insertIndex = body.getChildIndex(parent);
    body.removeChild(parent);
  }

  // Remove any pre-existing placeholder content from template
  removeElementsContainingText_(body, "No Batch tasks");
  removeElementsContainingText_(body, "No recipe linked");
  removeElementsContainingText_(body, "No recipe lines");

  // Insert feedback link at the top of content
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

  // Additional Tasks section (blank lines for handwritten tasks)
  insertIndex = insertAdditionalTasks_(body, insertIndex);

  // Append content programmatically
  // Pre-filter batches that have a recipe with at least one line
  const visibleBatchTasks = batchTasks.filter((t) => {
    if (!t.recipeId) return false;
    return (linesByRecipeId[t.recipeId] || []).length > 0;
  });

  if (!visibleBatchTasks.length) {
    body.insertParagraph(insertIndex, "No Batch tasks with ingredients found.");
  } else {
    let idx = insertIndex;

    visibleBatchTasks.forEach((t, i) => {
      if (i > 0) body.insertHorizontalRule(idx++);
      if (i > 0) body.insertPageBreak(idx++);

      const batchPara = body.insertParagraph(idx++, t.itemName);
      batchPara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
      const toMakeText = `To Make: ${formatQtyWithBuffer_(t.targetQty, t.unit)}`.trim();
      const toMakePara = body.insertParagraph(idx++, toMakeText);
      toMakePara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
      const baseQtyText = `${fmtQty_(t.targetQty)}${t.unit || ""}`;
      appendTextWithBoldUnderline_(toMakePara, toMakeText, baseQtyText);

      // Par level + stock counted lines (HEADING3) immediately after the item heading
      idx = insertParStockLines_(body, idx, t);

      // Add scaler link if configured
      const scalerLink = getScalerLink_(t.recipeId);
      if (scalerLink) {
        const scalerPara = body.insertParagraph(idx++, "");
        scalerPara.setFontFamily("Avenir");
        scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
        scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
        body.insertParagraph(idx++, "");
      }

      const lines = linesByRecipeId[t.recipeId] || [];
      lines.forEach((ln) => {
        const comp = itemsById[ln.itemId];
        const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
        const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

        const multiplier = t.batchesNeeded || 1;
        const total = ln.qtyPerBatch * multiplier;
        if (!Number.isFinite(total) || total === 0) return;

        const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
        const li = body.insertListItem(idx++, bulletText);
        li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");

        const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
        appendTextWithBoldUnderline_(li, bulletText, bulletBaseQty);
      });

      if ((t.method || "").trim()) {
        const spacerPara = body.insertParagraph(idx++, "");

        const methodHead = body.insertParagraph(idx++, "Method:");
        methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

        const methodLines = String(t.method || "").split(/\r?\n/);
        methodLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) {
            body.insertParagraph(idx++, txt).setFontFamily("Avenir");
          }
        });
      }

      if ((t.notes || "").trim()) {
        const notesHead = body.insertParagraph(idx++, "Notes:");
        notesHead.editAsText().setBold(true).setFontFamily("Avenir");

        const noteLines = String(t.notes || "").split(/\r?\n/);
        noteLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) {
            body.insertParagraph(idx++, txt).setFontFamily("Avenir");
          }
        });
      }

    });
  }

  cleanupMarkers_(body);
  doc.saveAndClose();
  return doc.getId();
}

/* =========================================================
 * INGREDIENT PREP DOC (TEMPLATE-FIRST)
 * ======================================================= */

function createIngredientPrepDoc_(folder, title, dateFormatted, runLabel, batchTasks, subTasksByItemId, linesByRecipeId, itemsById, runId) {
  const templateId = getOptionalProp_(CFG.props.templateIngredientPrep);
  const staffRole = "Prep Team";

  if (templateId && templateExists_(templateId)) {
    try {
      return createIngredientPrepDocFromTemplate_(folder, title, dateFormatted, runLabel, batchTasks, subTasksByItemId, linesByRecipeId, itemsById, templateId, runId, staffRole);
    } catch (e) {
      Logger.log(`Template processing failed for Ingredient Prep doc: ${e.message}. Falling back to programmatic.`);
      Logger.log(e.stack);
    }
  } else {
    Logger.log("Template not found for Ingredient Prep doc, using programmatic fallback.");
  }

  return createOrReplaceIngredientPrepDoc_(folder, title, dateFormatted, batchTasks, subTasksByItemId, linesByRecipeId, itemsById, runId, staffRole);
}

/**
 * HYBRID TEMPLATE: Ingredient Prep List
 * Template provides: header branding
 * Code provides: batch/sub-recipe content
 */
function createIngredientPrepDocFromTemplate_(folder, title, dateFormatted, runLabel, batchTasks, subTasksByItemId, linesByRecipeId, itemsById, templateId, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = copyTemplate_(templateId, folder, title);
  const body = doc.getBody();

  // Replace header placeholders
  replaceAllPlaceholders_(doc, {
    DATE: dateFormatted,
    RUN_LABEL: runLabel,
  });

  // Find and remove {{CONTENT}} marker
  const contentMarker = "{{CONTENT}}";
  const searchResult = body.findText(contentMarker);
  let insertIndex = body.getNumChildren();

  if (searchResult) {
    const element = searchResult.getElement();
    let parent = element.getParent();
    while (parent.getParent() && parent.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
      parent = parent.getParent();
    }
    insertIndex = body.getChildIndex(parent);
    body.removeChild(parent);
  }

  // Remove any pre-existing placeholder content from template
  removeElementsContainingText_(body, "No Batch tasks");
  removeElementsContainingText_(body, "No sub-recipe prep");
  removeElementsContainingText_(body, "No batches with");
  removeElementsContainingText_(body, "No prep tasks");
  removeElementsContainingText_(body, "No recipe linked");

  // Insert feedback link at the top of content
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

  // Additional Tasks section (blank lines for handwritten tasks)
  insertIndex = insertAdditionalTasks_(body, insertIndex);

  // Append content programmatically
  // Helper function to get sub-recipe requirements for a batch
  function getSubRecipeRequirements(batch) {
    if (!batch.recipeId) return [];
    const lines = linesByRecipeId[batch.recipeId] || [];
    const neededSubIds = [];
    const seen = new Set();
    lines.forEach((ln) => {
      const comp = itemsById[ln.itemId];
      if (!comp) return;
      const compType = normaliseItemType_(cellToText_(comp.fields[CFG.airtable.fields.itemType]));
      if (!CFG.airtable.itemTypes.subRecipeVariants.has(compType)) return;
      if (!seen.has(ln.itemId)) {
        seen.add(ln.itemId);
        neededSubIds.push(ln.itemId);
      }
    });
    return neededSubIds.map((id) => subTasksByItemId[id]).filter(Boolean);
  }

  // Pre-filter batches to only those with sub-recipe requirements
  const batchesWithSubRecipes = batchTasks.filter((batch) => {
    return getSubRecipeRequirements(batch).length > 0;
  });

  // Flat model fallback (e.g. Waratah): tasks are the top-level prep items with no nested sub-recipes.
  const tasksToRender = batchesWithSubRecipes.length ? null : batchTasks;

  if (tasksToRender !== null) {
    if (!tasksToRender.length) {
      body.insertParagraph(insertIndex, "No prep tasks found.");
    } else {
      let idx = insertIndex;
      tasksToRender.forEach((task, i) => {
        if (i > 0) body.insertHorizontalRule(idx++);
        if (i > 0) body.insertPageBreak(idx++);

        const taskPara = body.insertParagraph(idx++, task.itemName);
        taskPara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
        const taskToMakeText = `To Make: ${formatQtyWithBuffer_(task.targetQty, task.unit)}`.trim();
        const taskToMakePara = body.insertParagraph(idx++, taskToMakeText);
        taskToMakePara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
        appendTextWithBoldUnderline_(taskToMakePara, taskToMakeText, `${fmtQty_(task.targetQty)}${task.unit || ""}`);

        // Par level + stock counted lines (HEADING3) immediately after the item heading
        idx = insertParStockLines_(body, idx, task);

        const scalerLink = getScalerLink_(task.recipeId);
        if (scalerLink) {
          const scalerPara = body.insertParagraph(idx++, "");
          scalerPara.setFontFamily("Avenir");
          scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
          scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
          body.insertParagraph(idx++, "");
        }

        const lines = task.recipeId ? (linesByRecipeId[task.recipeId] || []) : [];
        if (!lines.length) {
          body.insertParagraph(idx++, task.recipeId ? "No recipe lines found." : "No recipe linked.").setFontFamily("Avenir");
        } else {
          lines.forEach((ln) => {
            const comp = itemsById[ln.itemId];
            const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
            const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";
            const total = ln.qtyPerBatch * (task.batchesNeeded || 1);
            if (!Number.isFinite(total) || total === 0) return;
            const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
            const bulletPara = body.insertParagraph(idx++, bulletText);
            bulletPara.setIndentStart(36).setFontFamily("Avenir");
            appendTextWithBoldUnderline_(bulletPara, bulletText, `${fmtQty_(total)}${compUnit || ""}`);
          });
        }

        if ((task.method || "").trim()) {
          const spacerPara = body.insertParagraph(idx++, "");

          const methodHead = body.insertParagraph(idx++, "Method:");
          methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

          task.method.split("\n").forEach((line) => {
            const txt = line.trim();
            if (txt) {
              body.insertParagraph(idx++, txt).setFontFamily("Avenir");
            }
          });
        }

        if ((task.notes || "").trim()) {
          const notesHead = body.insertParagraph(idx++, "Notes:");
          notesHead.editAsText().setBold(true).setFontFamily("Avenir");

          task.notes.split("\n").forEach((line) => {
            const txt = line.trim();
            if (txt) {
              body.insertParagraph(idx++, txt).setFontFamily("Avenir");
            }
          });
        }

      });
    }
  } else {
    let idx = insertIndex;
    const printedSub = new Set();

    batchesWithSubRecipes.forEach((batch, batchIdx) => {
      if (batchIdx > 0) body.insertHorizontalRule(idx++);
      if (batchIdx > 0) body.insertPageBreak(idx++);

      const batchPara = body.insertParagraph(idx++, batch.itemName);
      batchPara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
      const batchToMakeText = `To Make: ${formatQtyWithBuffer_(batch.targetQty, batch.unit)}`.trim();
      const batchToMakePara = body.insertParagraph(idx++, batchToMakeText);
      batchToMakePara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
      const batchBaseQty = `${fmtQty_(batch.targetQty)}${batch.unit || ""}`;
      appendTextWithBoldUnderline_(batchToMakePara, batchToMakeText, batchBaseQty);

      // Par level + stock counted lines (HEADING3) immediately after the batch heading
      idx = insertParStockLines_(body, idx, batch);

      const requiredSubTasks = getSubRecipeRequirements(batch);

      requiredSubTasks.forEach((subTask) => {
        const subId = subTask.itemId;

        if (printedSub.has(subId)) {
          const seeAboveText = `See above: ${subTask.itemName} ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
          const li = body.insertListItem(idx++, seeAboveText);
          li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");

          const seeAboveBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
          appendTextWithBoldUnderline_(li, seeAboveText, seeAboveBaseQty);
          return;
        }

        printedSub.add(subId);

        const subPara = body.insertParagraph(idx++, subTask.itemName);
        subPara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
        const subToMakeText = `To Make: ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
        const subToMakePara = body.insertParagraph(idx++, subToMakeText);
        subToMakePara.setFontFamily("Avenir").setFontSize(12);
        const subBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
        appendTextWithBoldUnderline_(subToMakePara, subToMakeText, subBaseQty);

        // Add scaler link for sub-recipe if configured
        const subScalerLink = getScalerLink_(subTask.recipeId);
        if (subScalerLink) {
          const scalerPara = body.insertParagraph(idx++, "");
          scalerPara.setFontFamily("Avenir");
          scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
          scalerPara.appendText("Scale this recipe").setLinkUrl(subScalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
          body.insertParagraph(idx++, "");
        }

        if (!subTask.recipeId) {
          const li = body.insertListItem(idx++, "No recipe linked.");
          li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");
          return;
        }

        const subLines = linesByRecipeId[subTask.recipeId] || [];
        if (!subLines.length) {
          const li = body.insertListItem(idx++, "No recipe lines found.");
          li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");
        } else {
          subLines.forEach((ln) => {
            const comp = itemsById[ln.itemId];
            const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
            const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

            const total = ln.qtyPerBatch * (subTask.batchesNeeded || 0);
            if (!Number.isFinite(total) || total === 0) return;

            const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
            const li = body.insertListItem(idx++, bulletText);
            li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");

            const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
            appendTextWithBoldUnderline_(li, bulletText, bulletBaseQty);
          });
        }

        if ((subTask.method || "").trim()) {
          const spacerPara = body.insertParagraph(idx++, "");

          const methodHead = body.insertParagraph(idx++, "Method:");
          methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

          const methodLines = String(subTask.method || "").split(/\r?\n/);
          methodLines.forEach((ln) => {
            const txt = ln.trim();
            if (txt) {
              body.insertParagraph(idx++, txt).setFontFamily("Avenir");
            }
          });
        }

        if ((subTask.notes || "").trim()) {
          const notesHead = body.insertParagraph(idx++, "Notes:");
          notesHead.editAsText().setBold(true).setFontFamily("Avenir");

          const noteLines = String(subTask.notes || "").split(/\r?\n/);
          noteLines.forEach((ln) => {
            const txt = ln.trim();
            if (txt) {
              body.insertParagraph(idx++, txt).setFontFamily("Avenir");
            }
          });
        }
      });

    });

    // Garnish & Other items have no parent Batch and no sub-recipe requirements, so they
    // are not captured by the batchesWithSubRecipes loop above. Render them as a standalone
    // section at the end of the document.
    const garnishOtherTasks = batchTasks.filter(
      (t) => CFG.airtable.itemTypes.ingredientPrepOnly.has(t.itemType)
    );
    if (garnishOtherTasks.length) {
      body.insertHorizontalRule(idx++);
      body.insertPageBreak(idx++);

      const garnishHeadPara = body.insertParagraph(idx++, "Garnish & Other");
      garnishHeadPara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");

      garnishOtherTasks.forEach((task) => {
        const garnishPara = body.insertParagraph(idx++, task.itemName);
        garnishPara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
        const garnishToMakeText = `To Make: ${formatQtyWithBuffer_(task.targetQty, task.unit)}`.trim();
        const garnishToMakePara = body.insertParagraph(idx++, garnishToMakeText);
        garnishToMakePara.setFontFamily("Avenir").setFontSize(12);
        appendTextWithBoldUnderline_(garnishToMakePara, garnishToMakeText, `${fmtQty_(task.targetQty)}${task.unit || ""}`);

        // Par level + stock counted lines (HEADING3) immediately after the item heading
        idx = insertParStockLines_(body, idx, task);

        const scalerLink = getScalerLink_(task.recipeId);
        if (scalerLink) {
          const scalerPara = body.insertParagraph(idx++, "");
          scalerPara.setFontFamily("Avenir");
          scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
          scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
          body.insertParagraph(idx++, "");
        }

        const lines = task.recipeId ? (linesByRecipeId[task.recipeId] || []) : [];
        if (!lines.length) {
          const li = body.insertListItem(idx++, task.recipeId ? "No recipe lines found." : "No recipe linked.");
          li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");
        } else {
          lines.forEach((ln) => {
            const comp = itemsById[ln.itemId];
            const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
            const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";
            const total = ln.qtyPerBatch * (task.batchesNeeded || 1);
            if (!Number.isFinite(total) || total === 0) return;
            const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
            const li = body.insertListItem(idx++, bulletText);
            li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily("Avenir");
            appendTextWithBoldUnderline_(li, bulletText, `${fmtQty_(total)}${compUnit || ""}`);
          });
        }

        if ((task.method || "").trim()) {
          body.insertParagraph(idx++, "");
          const methodHead = body.insertParagraph(idx++, "Method:");
          methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
          String(task.method || "").split(/\r?\n/).forEach((ln) => {
            const txt = ln.trim();
            if (txt) body.insertParagraph(idx++, txt).setFontFamily("Avenir");
          });
        }

        if ((task.notes || "").trim()) {
          const notesHead = body.insertParagraph(idx++, "Notes:");
          notesHead.editAsText().setBold(true).setFontFamily("Avenir");
          String(task.notes || "").split(/\r?\n/).forEach((ln) => {
            const txt = ln.trim();
            if (txt) body.insertParagraph(idx++, txt).setFontFamily("Avenir");
          });
        }
      });
    }
  }

  cleanupMarkers_(body);
  doc.saveAndClose();
  return doc.getId();
}

/* =========================================================
 * SLACK
 * ======================================================= */

function postPrepRunToSlack_({ runLabel, ingredientDoc, batchingDoc }) {
  if (SKIP_SLACK) return;

  const text =
    `*Prep Run ${runLabel}*\n` +
    `• ${slackLink_(ingredientDoc.url, ingredientDoc.title)}\n` +
    `• ${slackLink_(batchingDoc.url, batchingDoc.title)}`;

  if (SLACK_WEBHOOK_OVERRIDE) {
    postToSlack_(SLACK_WEBHOOK_OVERRIDE, text);
    return;
  }

  const prepWebhook = getSlackWebhook_(CFG.props.slackPrep);
  tryPostToSlack_(prepWebhook, text, "Prep");
}

function postToSlack_(webhookUrl, text) {
  const payload = JSON.stringify({ text });
  const resp = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload,
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const body = resp.getContentText();
  if (code < 200 || code >= 300) throw new Error(`Slack webhook failed (${code}): ${body}`);
}

function tryPostToSlack_(webhookUrl, text, label) {
  try {
    postToSlack_(webhookUrl, text);
  } catch (e) {
    Logger.log(`Slack warning (${label}): ${e.message} — continuing without Slack notification.`);
  }
}

function getSlackWebhook_(propName) {
  const v = getProp_(propName);
  if (!v.startsWith("https://hooks.slack.com/services/")) {
    throw new Error(`${propName} does not look like a Slack webhook URL.`);
  }
  return v;
}

function slackLink_(url, label) {
  return `<${url}|${label}>`;
}

function docUrl_(docId) {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

/* =========================================================
 * RECIPE LINES
 * ======================================================= */

function getRecipeLinesByRecipeId_(recipeIdSet) {
  if (!recipeIdSet || recipeIdSet.size === 0) return {};

  const lines = airtableListAll_(CFG.airtable.tables.recipeLines, {
    fields: [CFG.airtable.fields.rlRecipe, CFG.airtable.fields.rlItem, CFG.airtable.fields.rlQty],
    pageSize: 100,
  });

  const byRecipe = {};

  lines.forEach((rec) => {
    const recipeId = firstId_(rec.fields[CFG.airtable.fields.rlRecipe]);
    const itemId = firstId_(rec.fields[CFG.airtable.fields.rlItem]);
    const qty = num_(rec.fields[CFG.airtable.fields.rlQty]);

    if (!recipeId || !itemId) return;
    if (!recipeIdSet.has(recipeId)) return;
    if (!Number.isFinite(qty) || qty === 0) return;

    if (!byRecipe[recipeId]) byRecipe[recipeId] = [];
    byRecipe[recipeId].push({ itemId, qtyPerBatch: qty });
  });

  return byRecipe;
}

/* =========================================================
 * FORMATTING HELPERS
 * ======================================================= */

function formatQtyWithBuffer_(qty, unit) {
  if (!Number.isFinite(qty) || qty === 0) return "";
  
  const buffered = qty * CFG.bufferMultiplier;
  const qtyStr = fmtQty_(qty);
  const bufferedStr = fmtQty_(buffered);
  const unitStr = unit || "";
  
  return `${qtyStr}${unitStr} (1.5× = ${bufferedStr}${unitStr})`;
}

function appendTextWithBoldUnderline_(paragraph, fullText, boldUnderlineText) {
  const text = paragraph.editAsText();
  const startIndex = fullText.indexOf(boldUnderlineText);
  if (startIndex === -1) return;

  const endIndex = startIndex + boldUnderlineText.length - 1;
  text.setBold(startIndex, endIndex, true);
  text.setUnderline(startIndex, endIndex, true);
  text.setFontFamily("Avenir");
}

/**
 * Insert HEADING3 par-level / stock-counted lines at the given index, immediately
 * after a HEADING1 item paragraph (template/insert-index path).
 *
 * Logic:
 *  - parQty > 0            → show "Par Level = …" + "Stock Counted = …"
 *  - parQty = 0 + parent   → show "Parent Ingredient = …" + "Required Parent Batch QTY = …"
 *  - parQty = 0 + no parent → show "Stock Counted = …" only if onHand > 0
 *
 * @param {Body}   body      Document body
 * @param {number} idx       Current insertion index (will be incremented and returned)
 * @param {Object} task      Enriched task object with parQty, onHand, parentBatchNames, parentBatchTargetQty, targetQty, unit
 * @returns {number}         Updated idx after any lines inserted
 */
function insertParStockLines_(body, idx, task) {
  return idx;
}

/**
 * Append HEADING3 par-level / stock-counted lines (programmatic/append path).
 * Same logic as insertParStockLines_ but uses appendParagraph instead of insertParagraph.
 *
 * @param {Body}   body  Document body
 * @param {Object} task  Enriched task object
 */
function appendParStockLines_(body, task) {
  return;
}

/**
 * Generate Recipe Scaler link for a recipe
 * Returns URL with page=scaler and recipeId parameters, or null if scaler not configured
 */
function getScalerLink_(recipeId) {
  const scalerUrl = getOptionalProp_(CFG.props.recipeScalerUrl);
  if (!scalerUrl || !recipeId) return null;

  // Ensure URL ends without trailing slash, then add parameters
  const baseUrl = scalerUrl.replace(/\/$/, '');
  return `${baseUrl}?page=scaler&recipeId=${encodeURIComponent(recipeId)}`;
}

/**
 * Generate Feedback Form link with pre-filled context
 * @param {string} prepRunId - The prep run record ID
 * @param {string} docType - Document type (e.g., "Batching List", "Andie Ordering")
 * @param {string} staffRole - Staff role (e.g., "Prep Team", "Ordering - Andie")
 * @returns {string|null} - The feedback URL or null if not configured
 */
function getFeedbackLink_(prepRunId, docType, staffRole) {
  const feedbackUrl = getOptionalProp_(CFG.props.feedbackFormUrl);
  if (!feedbackUrl) return null;

  const baseUrl = feedbackUrl.replace(/\/$/, '');
  const params = [];

  if (prepRunId) params.push(`prepRunId=${encodeURIComponent(prepRunId)}`);
  if (docType) params.push(`docType=${encodeURIComponent(docType)}`);
  if (staffRole) params.push(`staffRole=${encodeURIComponent(staffRole)}`);

  return params.length ? `${baseUrl}?${params.join('&')}` : baseUrl;
}

/**
 * Insert a feedback link at the given index in a document body
 * @param {Body} body - The document body
 * @param {number} insertIndex - The index to insert at
 * @param {string} prepRunId - The prep run record ID
 * @param {string} docType - Document type
 * @param {string} staffRole - Staff role
 * @returns {number} - The new insert index after insertion (incremented if link was added)
 */
function insertFeedbackLink_(body, insertIndex, prepRunId, docType, staffRole) {
  const feedbackLink = getFeedbackLink_(prepRunId, docType, staffRole);
  if (!feedbackLink) return insertIndex;

  const para = body.insertParagraph(insertIndex, "");
  para.setFontFamily("Avenir");
  para.appendText("Have feedback? ").setFontSize(10).setForegroundColor("#666666").setFontFamily("Avenir");
  para.appendText("Submit here").setLinkUrl(feedbackLink).setFontSize(10).setForegroundColor("#007AFF").setUnderline(true).setFontFamily("Avenir");
  para.setSpacingAfter(8);

  return insertIndex + 1;
}

/**
 * Append a feedback link at the end of a document body
 * @param {Body} body - The document body
 * @param {string} prepRunId - The prep run record ID
 * @param {string} docType - Document type
 * @param {string} staffRole - Staff role
 */
function appendFeedbackLink_(body, prepRunId, docType, staffRole) {
  const feedbackLink = getFeedbackLink_(prepRunId, docType, staffRole);
  if (!feedbackLink) return;

  body.appendParagraph(""); // Spacer
  const para = body.appendParagraph("");
  para.setFontFamily("Avenir");
  para.appendText("Have feedback? ").setFontSize(10).setForegroundColor("#666666").setFontFamily("Avenir");
  para.appendText("Submit here").setLinkUrl(feedbackLink).setFontSize(10).setForegroundColor("#007AFF").setUnderline(true).setFontFamily("Avenir");
}

/**
 * Append an "Additional Tasks" section (HEADING2 + 10 blank lines) using appendParagraph.
 * Used in programmatic/append path for Batching and Ingredient Prep docs.
 */
function appendAdditionalTasks_(body) {
  body.appendParagraph("Additional Tasks")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
  for (var i = 0; i < 7; i++) {
    body.appendListItem("").setGlyphType(DocumentApp.GlyphType.SQUARE_BULLET).setFontFamily("Avenir");
  }
}

/**
 * Insert an "Additional Tasks" section (HEADING2 + 10 blank lines) using insertParagraph.
 * Used in template/insert-index path for Batching and Ingredient Prep docs.
 * @param {Body} body  Document body
 * @param {number} idx Current insertion index
 * @returns {number}   Updated idx
 */
function insertAdditionalTasks_(body, idx) {
  body.insertParagraph(idx++, "Additional Tasks")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
  for (var i = 0; i < 7; i++) {
    body.insertListItem(idx++, "").setGlyphType(DocumentApp.GlyphType.SQUARE_BULLET).setFontFamily("Avenir");
  }
  return idx;
}

/* =========================================================
 * PROGRAMMATIC FALLBACK DOCS
 * ======================================================= */

function createOrReplaceBatchingDoc_(folder, title, dateFormatted, batchTasks, linesByRecipeId, itemsById, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = DocumentApp.create(title);
  const id = doc.getId();
  moveToFolder_(id, folder);
  doc.setName(title);

  const body = doc.getBody();
  body.clearContent();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE).setFontFamily("Avenir");
  body.appendParagraph("Name: _______").setFontFamily("Avenir");

  // Add feedback link
  appendFeedbackLink_(body, runId, title, staffRole);

  // Additional Tasks section (blank lines for handwritten tasks)
  appendAdditionalTasks_(body);

  // Pre-filter batches that have a recipe with at least one line
  const visibleBatchTasks = batchTasks.filter((t) => {
    if (!t.recipeId) return false;
    return (linesByRecipeId[t.recipeId] || []).length > 0;
  });

  if (!visibleBatchTasks.length) {
    body.appendParagraph("No Batch tasks with ingredients found.");
    doc.saveAndClose();
    return id;
  }

  visibleBatchTasks.forEach((t, i) => {
    if (i > 0) body.appendHorizontalRule();
    if (i > 0) body.appendPageBreak();

    const batchPara = body.appendParagraph(t.itemName).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
    const toMakeText = `To Make: ${formatQtyWithBuffer_(t.targetQty, t.unit)}`.trim();
    const toMakePara = body.appendParagraph(toMakeText).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
    const baseQtyText = `${fmtQty_(t.targetQty)}${t.unit || ""}`;
    appendTextWithBoldUnderline_(toMakePara, toMakeText, baseQtyText);

    // Par level + stock counted lines (HEADING3) immediately after the item heading
    appendParStockLines_(body, t);

    // Add scaler link if configured
    const scalerLink = getScalerLink_(t.recipeId);
    if (scalerLink) {
      const scalerPara = body.appendParagraph("");
      scalerPara.setFontFamily("Avenir");
      scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
      scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
      body.appendParagraph("");
    }

    const lines = linesByRecipeId[t.recipeId] || [];
    lines.forEach((ln) => {
      const comp = itemsById[ln.itemId];
      const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
      const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

      const multiplier = t.batchesNeeded || 1;
      const total = ln.qtyPerBatch * multiplier;
      if (!Number.isFinite(total) || total === 0) return;

      const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
      const bulletPara = appendBullet_(body, bulletText);
      bulletPara.setFontFamily("Avenir");

      const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
      appendTextWithBoldUnderline_(bulletPara, bulletText, bulletBaseQty);
    });

    if ((t.method || "").trim()) {
      const spacerPara = body.appendParagraph("");

      const methodHead = body.appendParagraph("Method:");
      methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

      const methodLines = String(t.method || "").split(/\r?\n/);
      methodLines.forEach((ln) => {
        const txt = ln.trim();
        if (txt) {
          body.appendParagraph(txt).setFontFamily("Avenir");
        }
      });
    }

    if ((t.notes || "").trim()) {
      const notesHead = body.appendParagraph("Notes:");
      notesHead.editAsText().setBold(true).setFontFamily("Avenir");

      const noteLines = String(t.notes || "").split(/\r?\n/);
      noteLines.forEach((ln) => {
        const txt = ln.trim();
        if (txt) {
          body.appendParagraph(txt).setFontFamily("Avenir");
        }
      });
    }

  });

  doc.saveAndClose();
  return id;
}

function createOrReplaceIngredientPrepDoc_(folder, title, dateFormatted, batchTasks, subTasksByItemId, linesByRecipeId, itemsById, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = DocumentApp.create(title);
  const id = doc.getId();
  moveToFolder_(id, folder);
  doc.setName(title);

  const body = doc.getBody();
  body.clearContent();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE).setFontFamily("Avenir");
  body.appendParagraph("Name: _______").setFontFamily("Avenir");

  // Add feedback link
  appendFeedbackLink_(body, runId, title, staffRole);

  // Additional Tasks section (blank lines for handwritten tasks)
  appendAdditionalTasks_(body);

  // Helper function to get sub-recipe requirements for a batch
  function getSubRecipeReqs(batch) {
    if (!batch.recipeId) return [];
    const lines = linesByRecipeId[batch.recipeId] || [];
    const neededSubIds = [];
    const seen = new Set();
    lines.forEach((ln) => {
      const comp = itemsById[ln.itemId];
      if (!comp) return;
      const compType = normaliseItemType_(cellToText_(comp.fields[CFG.airtable.fields.itemType]));
      if (!CFG.airtable.itemTypes.subRecipeVariants.has(compType)) return;
      if (!seen.has(ln.itemId)) {
        seen.add(ln.itemId);
        neededSubIds.push(ln.itemId);
      }
    });
    return neededSubIds.map((id) => subTasksByItemId[id]).filter(Boolean);
  }

  // Pre-filter batches to only those with sub-recipe requirements
  const batchesWithSubRecipes = batchTasks.filter((batch) => {
    return getSubRecipeReqs(batch).length > 0;
  });

  // Flat model fallback (e.g. Waratah): tasks are the top-level prep items with no nested sub-recipes.
  // Render them directly with their recipe lines + method.
  const tasksToRender = batchesWithSubRecipes.length ? null : batchTasks;

  if (tasksToRender !== null) {
    if (!tasksToRender.length) {
      body.appendParagraph("No prep tasks found.");
      doc.saveAndClose();
      return id;
    }
    tasksToRender.forEach((task, i) => {
      if (i > 0) body.appendHorizontalRule();
      if (i > 0) body.appendPageBreak();

      const taskPara = body.appendParagraph(task.itemName).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
      const taskToMakeText = `To Make: ${formatQtyWithBuffer_(task.targetQty, task.unit)}`.trim();
      const taskToMakePara = body.appendParagraph(taskToMakeText).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
      appendTextWithBoldUnderline_(taskToMakePara, taskToMakeText, `${fmtQty_(task.targetQty)}${task.unit || ""}`);

      // Par level + stock counted lines (HEADING3) immediately after the item heading
      appendParStockLines_(body, task);

      const scalerLink = getScalerLink_(task.recipeId);
      if (scalerLink) {
        const scalerPara = body.appendParagraph("");
        scalerPara.setFontFamily("Avenir");
        scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
        scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
        body.appendParagraph("");
      }

      const lines = task.recipeId ? (linesByRecipeId[task.recipeId] || []) : [];
      if (!lines.length) {
        appendBullet_(body, task.recipeId ? "No recipe lines found." : "No recipe linked.").setFontFamily("Avenir");
      } else {
        lines.forEach((ln) => {
          const comp = itemsById[ln.itemId];
          const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
          const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";
          const total = ln.qtyPerBatch * (task.batchesNeeded || 0);
          if (!Number.isFinite(total) || total === 0) return;
          const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
          const bulletPara = appendBullet_(body, bulletText);
          bulletPara.setFontFamily("Avenir");
          appendTextWithBoldUnderline_(bulletPara, bulletText, `${fmtQty_(total)}${compUnit || ""}`);
        });
      }

      if ((task.method || "").trim()) {
        const spacerPara = body.appendParagraph("");

        const methodHead = body.appendParagraph("Method:");
        methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

        const methodLines = String(task.method || "").split(/\r?\n/);
        methodLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) {
            body.appendParagraph(txt).setFontFamily("Avenir");
          }
        });
      }

      if ((task.notes || "").trim()) {
        const notesHead = body.appendParagraph("Notes:");
        notesHead.editAsText().setBold(true).setFontFamily("Avenir");

        const noteLines = String(task.notes || "").split(/\r?\n/);
        noteLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) {
            body.appendParagraph(txt).setFontFamily("Avenir");
          }
        });
      }

    });
    doc.saveAndClose();
    return id;
  }

  const printedSub = new Set();

  batchesWithSubRecipes.forEach((batch, batchIdx) => {
    if (batchIdx > 0) body.appendHorizontalRule();
    if (batchIdx > 0) body.appendPageBreak();

    const batchPara = body.appendParagraph(batch.itemName).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
    const batchToMakeText = `To Make: ${formatQtyWithBuffer_(batch.targetQty, batch.unit)}`.trim();
    const batchToMakePara = body.appendParagraph(batchToMakeText).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
    const batchBaseQty = `${fmtQty_(batch.targetQty)}${batch.unit || ""}`;
    appendTextWithBoldUnderline_(batchToMakePara, batchToMakeText, batchBaseQty);

    // Par level + stock counted lines (HEADING3) immediately after the batch heading
    appendParStockLines_(body, batch);

    const requiredSubTasks = getSubRecipeReqs(batch);

    requiredSubTasks.forEach((subTask) => {
      const subId = subTask.itemId;

      if (printedSub.has(subId)) {
        const seeAboveText = `See above: ${subTask.itemName} ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
        const seeAbovePara = appendBullet_(body, seeAboveText);
        seeAbovePara.setFontFamily("Avenir");

        const seeAboveBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
        appendTextWithBoldUnderline_(seeAbovePara, seeAboveText, seeAboveBaseQty);
        return;
      }

      printedSub.add(subId);

      const subPara = body.appendParagraph(subTask.itemName).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
      const subToMakeText = `To Make: ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
      const subToMakePara = body.appendParagraph(subToMakeText);
      subToMakePara.setFontFamily("Avenir").setFontSize(12);
      const subBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
      appendTextWithBoldUnderline_(subToMakePara, subToMakeText, subBaseQty);

      // Add scaler link for sub-recipe if configured
      const subScalerLink = getScalerLink_(subTask.recipeId);
      if (subScalerLink) {
        const scalerPara = body.appendParagraph("");
        scalerPara.setFontFamily("Avenir");
        scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
        scalerPara.appendText("Scale this recipe").setLinkUrl(subScalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
        body.appendParagraph("");
      }

      if (!subTask.recipeId) {
        appendBullet_(body, "No recipe linked.").setFontFamily("Avenir");
        return;
      }

      const subLines = linesByRecipeId[subTask.recipeId] || [];
      if (!subLines.length) {
        appendBullet_(body, "No recipe lines found.").setFontFamily("Avenir");
      } else {
        subLines.forEach((ln) => {
          const comp = itemsById[ln.itemId];
          const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
          const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

          const total = ln.qtyPerBatch * (subTask.batchesNeeded || 0);
          if (!Number.isFinite(total) || total === 0) return;

          const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
          const bulletPara = appendBullet_(body, bulletText);
          bulletPara.setFontFamily("Avenir");

          const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
          appendTextWithBoldUnderline_(bulletPara, bulletText, bulletBaseQty);
        });
      }

      if ((subTask.method || "").trim()) {
        const spacerPara = body.appendParagraph("");

        const methodHead = body.appendParagraph("Method:");
        methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

        const methodLines = String(subTask.method || "").split(/\r?\n/);
        methodLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) {
            body.appendParagraph(txt).setFontFamily("Avenir");
          }
        });
      }

      if ((subTask.notes || "").trim()) {
        const notesHead = body.appendParagraph("Notes:");
        notesHead.editAsText().setBold(true).setFontFamily("Avenir");

        const noteLines = String(subTask.notes || "").split(/\r?\n/);
        noteLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) {
            body.appendParagraph(txt).setFontFamily("Avenir");
          }
        });
      }
    });

  });

  // Garnish & Other items have no parent Batch and no sub-recipe requirements, so they
  // are not captured by the batchesWithSubRecipes loop above. Render them as a standalone
  // section at the end of the document.
  const garnishOtherTasks = batchTasks.filter(
    (t) => CFG.airtable.itemTypes.ingredientPrepOnly.has(t.itemType)
  );
  if (garnishOtherTasks.length) {
    body.appendHorizontalRule();
    body.appendPageBreak();

    body.appendParagraph("Garnish & Other").setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");

    garnishOtherTasks.forEach((task) => {
      const garnishPara = body.appendParagraph(task.itemName).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
      const garnishToMakeText = `To Make: ${formatQtyWithBuffer_(task.targetQty, task.unit)}`.trim();
      const garnishToMakePara = body.appendParagraph(garnishToMakeText);
      garnishToMakePara.setFontFamily("Avenir").setFontSize(12);
      appendTextWithBoldUnderline_(garnishToMakePara, garnishToMakeText, `${fmtQty_(task.targetQty)}${task.unit || ""}`);

      // Par level + stock counted lines (HEADING3) immediately after the item heading
      appendParStockLines_(body, task);

      const scalerLink = getScalerLink_(task.recipeId);
      if (scalerLink) {
        const scalerPara = body.appendParagraph("");
        scalerPara.setFontFamily("Avenir");
        scalerPara.appendText("📐 ").setFontSize(10).setFontFamily("Avenir");
        scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF").setFontFamily("Avenir");
        body.appendParagraph("");
      }

      const lines = task.recipeId ? (linesByRecipeId[task.recipeId] || []) : [];
      if (!lines.length) {
        appendBullet_(body, task.recipeId ? "No recipe lines found." : "No recipe linked.").setFontFamily("Avenir");
      } else {
        lines.forEach((ln) => {
          const comp = itemsById[ln.itemId];
          const compName = comp ? String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
          const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";
          const total = ln.qtyPerBatch * (task.batchesNeeded || 1);
          if (!Number.isFinite(total) || total === 0) return;
          const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
          const bulletPara = appendBullet_(body, bulletText);
          bulletPara.setFontFamily("Avenir");
          appendTextWithBoldUnderline_(bulletPara, bulletText, `${fmtQty_(total)}${compUnit || ""}`);
        });
      }

      if ((task.method || "").trim()) {
        body.appendParagraph("");
        const methodHead = body.appendParagraph("Method:");
        methodHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
        String(task.method || "").split(/\r?\n/).forEach((ln) => {
          const txt = ln.trim();
          if (txt) body.appendParagraph(txt).setFontFamily("Avenir");
        });
      }

      if ((task.notes || "").trim()) {
        const notesHead = body.appendParagraph("Notes:");
        notesHead.editAsText().setBold(true).setFontFamily("Avenir");
        String(task.notes || "").split(/\r?\n/).forEach((ln) => {
          const txt = ln.trim();
          if (txt) body.appendParagraph(txt).setFontFamily("Avenir");
        });
      }
    });
  }

  doc.saveAndClose();
  return id;
}

function appendBullet_(body, text) {
  const li = body.appendListItem(String(text || ""));
  li.setGlyphType(DocumentApp.GlyphType.BULLET);
  return li;
}

function appendMultiline_(body, text) {
  const lines = String(text || "").split(/\r?\n/);
  lines.forEach((ln) => {
    const t = ln.trim();
    if (t) body.appendParagraph(t);
  });
}

/* =========================================================
 * ORDERING FALLBACK
 * ======================================================= */

/* =========================================================
 * COMBINED ORDERING DOC EXPORT
 *
 * Triggered manually by Evan after bar stock count is complete
 * and Waratah_GenerateStockOrders has created Stock Order records.
 *
 * Reads:
 * - Stock Orders (session status = "Orders Generated") — bar stock items
 * - Ingredient Requirements (from latest Prep Run) — prep-only items
 *   (items with Bar Stock = false that aren't made in-house)
 *
 * Produces a single ordering doc grouped by supplier, with a
 * "PREP-ONLY ITEMS" section for non-bar-stock ingredients.
 * ======================================================= */

function exportCombinedOrderingDoc_() {
  const F = CFG.airtable.fields;
  const T = CFG.airtable.tables;

  // ── 1. Find the latest "Orders Generated" session ──
  const sessions = airtableListAll_(T.countSessions, {
    fields: [F.csStatus, F.csDate, F.csCountedBy],
    filterByFormula: `{${F.csStatus}}="Orders Generated"`,
    pageSize: 20,
  });

  if (!sessions.length) {
    throw new Error('No Count Session with status "Orders Generated" found. Run the bar stock count workflow first.');
  }

  sessions.sort((a, b) => {
    const da = a.fields[F.csDate] || "";
    const db = b.fields[F.csDate] || "";
    return db.localeCompare(da);
  });

  const session = sessions[0];
  const sessionName = session.fields[F.csDate] || "Stock Count";
  const sessionDate = session.fields[F.csDate] || "";
  const countedBy = cellToText_(session.fields[F.csCountedBy]) || "Evan";

  // ── 2. Fetch Stock Orders for this session ──
  // Filter by linked Count Session record ID using FIND() on the linked field
  const allOrders = airtableListAll_(T.stockOrders, {
    fields: [
      F.soItem, F.soSession, F.soOnHand, F.soPrepUsage,
      F.soParQty, F.soServiceShortfall, F.soCombinedQty,
      F.soSupplierStatic, F.soCategoryStatic, F.soStaffStatic, F.soStatus,
    ],
    pageSize: 100,
  });

  // Client-side filter: match orders linked to this session
  const orders = allOrders.filter(o => {
    const sessionIds = o.fields[F.soSession];
    return Array.isArray(sessionIds) && sessionIds.includes(session.id);
  });

  Logger.log(`Stock Orders fetched: ${orders.length} records for session ${session.id}`);

  // Collect item IDs from orders to resolve names
  const orderItemIds = new Set();
  orders.forEach(o => {
    const itemId = firstId_(o.fields[F.soItem]);
    if (itemId) orderItemIds.add(itemId);
  });

  // ── 3. Fetch items for name resolution ──
  const orderItemsById = orderItemIds.size
    ? indexById_(airtableGetByIds_(T.items, Array.from(orderItemIds), [
        F.itemName, F.itemUnit, F.itemType, F.itemBarStock,
      ]))
    : {};

  // ── 4. Build supplier-grouped bar stock order rows ──
  const supplierMap = new Map();     // supplierName → [rows]
  const noSupplierRows = [];

  orders.forEach(o => {
    const combinedQty = num_(o.fields[F.soCombinedQty]);
    if (!Number.isFinite(combinedQty) || combinedQty <= 0) return;

    const itemId = firstId_(o.fields[F.soItem]);
    const item = itemId ? orderItemsById[itemId] : null;
    const itemName = item ? String(item.fields[F.itemName] || "(Unnamed)").replace(/[\r\n]+/g, " ").trim() : "(Unknown Item)";
    const unit = item ? cellToText_(item.fields[F.itemUnit]) : "";
    const supplier = String(o.fields[F.soSupplierStatic] || "").trim();
    const onHand = num_(o.fields[F.soOnHand]);
    const parQty = num_(o.fields[F.soParQty]);
    const prepUsage = num_(o.fields[F.soPrepUsage]);
    const shortfall = num_(o.fields[F.soServiceShortfall]);

    const row = { itemName, unit, onHand, parQty, prepUsage, shortfall, combinedQty };

    if (supplier) {
      if (!supplierMap.has(supplier)) supplierMap.set(supplier, []);
      supplierMap.get(supplier).push(row);
    } else {
      noSupplierRows.push(row);
    }
  });

  // ── 5. Fetch latest Prep Run (cached — reused for folder lookup in step 7) ──
  let cachedLatestRun = null;
  try { cachedLatestRun = getLatestRunWithData_(); } catch (e) {
    Logger.log(`WARNING: Could not fetch latest Prep Run — ${e.message}`);
  }

  // ── 5b. Fetch prep-only items from latest Prep Run's Ingredient Requirements ──
  //   Items with Bar Stock = false that aren't made in-house
  const prepOnlyRows = [];

  try {
    if (cachedLatestRun) {
      const latestRun = cachedLatestRun;
      const reqIds = Array.isArray(latestRun.fields[F.runReqsLinkBack])
        ? latestRun.fields[F.runReqsLinkBack] : [];

      if (reqIds.length) {
        const reqs = airtableGetByIds_(T.reqs, reqIds, [
          F.reqItem, F.reqQty, F.reqSupplierNameStatic, F.reqStaffStatic,
        ]);

        // Fetch any item IDs we don't already have
        const missingItemIds = new Set();
        reqs.forEach(r => {
          const id = firstId_(r.fields[F.reqItem]);
          if (id && !orderItemsById[id]) missingItemIds.add(id);
        });

        if (missingItemIds.size) {
          const extraItems = airtableGetByIds_(T.items, Array.from(missingItemIds), [
            F.itemName, F.itemUnit, F.itemType, F.itemBarStock,
          ]);
          extraItems.forEach(item => { orderItemsById[item.id] = item; });
        }

        // Track which item IDs are already in Stock Orders (bar stock items)
        const barStockItemIds = new Set();
        orders.forEach(o => {
          const id = firstId_(o.fields[F.soItem]);
          if (id) barStockItemIds.add(id);
        });

        // Aggregate prep-only items by itemId (same item may appear in multiple recipes).
        // orderingStaff is a lookup chain: Item → Supplier → Ordering Staff, so it is
        // consistent per item. First-seen value is kept on duplicate; conflicts are not expected.
        const prepOnlyAgg = new Map(); // itemId -> { itemName, unit, qty, supplier, orderingStaff }

        reqs.forEach(r => {
          const itemId = firstId_(r.fields[F.reqItem]);
          if (!itemId || barStockItemIds.has(itemId)) return;

          const item = orderItemsById[itemId];
          if (!item) return;

          // Skip in-house items (Batch, Sub Recipe, Garnish, Other)
          const itemType = normaliseItemType_(cellToText_(item.fields[F.itemType]));
          if (
            itemType === CFG.airtable.itemTypes.batch ||
            itemType === CFG.airtable.itemTypes.subRecipe ||
            CFG.airtable.itemTypes.subRecipeVariants.has(itemType) ||
            CFG.airtable.itemTypes.ingredientPrepOnly.has(itemType)
          ) return;

          // Skip items flagged as bar stock (they should be in Stock Orders already)
          if (item.fields[F.itemBarStock] === true) return;

          const qty = num_(r.fields[F.reqQty]);
          if (!Number.isFinite(qty) || qty <= 0) return;

          const itemName = String(item.fields[F.itemName] || "(Unnamed)").replace(/[\r\n]+/g, " ").trim();
          const unit = cellToText_(item.fields[F.itemUnit]);
          const supplier = String(r.fields[F.reqSupplierNameStatic] || "").trim();
          const orderingStaff = String(r.fields[F.reqStaffStatic] || "").trim();

          if (prepOnlyAgg.has(itemId)) {
            prepOnlyAgg.get(itemId).qty += qty;
          } else {
            prepOnlyAgg.set(itemId, { itemName, unit, qty, supplier, orderingStaff });
          }
        });

        prepOnlyAgg.forEach(row => prepOnlyRows.push(row));
      }
    }
  } catch (e) {
    Logger.log(`WARNING: Could not fetch prep-only items — ${e.message}. Continuing without prep-only section.`);
  }

  // Split prep-only rows by ordering staff: Andie and Blade get their own sections
  const andieRows = [];
  const bladeRows = [];
  const otherPrepRows = [];
  prepOnlyRows.forEach(row => {
    const staff = (row.orderingStaff || "").toLowerCase();
    if (staff === "blade") {
      bladeRows.push(row);
    } else if (staff === "andie") {
      andieRows.push(row);
    } else {
      otherPrepRows.push(row);
    }
  });

  // Helper: group rows by supplier name
  function buildSupplierGroups_(rows) {
    const grouped = new Map(); // supplierName → [rows]
    const noSupplier = [];
    rows.forEach(row => {
      if (row.supplier) {
        if (!grouped.has(row.supplier)) grouped.set(row.supplier, []);
        grouped.get(row.supplier).push(row);
      } else {
        noSupplier.push(row);
      }
    });
    return { grouped, noSupplier };
  }

  const andieGroups = buildSupplierGroups_(andieRows);
  const bladeGroups = buildSupplierGroups_(bladeRows);

  Logger.log(`Supplier groups: ${supplierMap.size}, No-supplier rows: ${noSupplierRows.length}, Andie rows: ${andieRows.length}, Blade rows: ${bladeRows.length}, Prep-only rows: ${otherPrepRows.length}`);

  // ── 6. Compute week ending date for doc title ──
  const weekEndDate = sessionDate ? computeWeekEndingFromDate_(sessionDate) : "";
  const docTitle = weekEndDate
    ? `Ordering Run Sheet — W.E. ${weekEndDate}`
    : `Ordering Run Sheet — ${sessionName}`;

  // ── 7. Create the document ──
  const rootFolder = DriveApp.getFolderById(getDocsFolderId_());

  // Place in the same Prep Run folder if one exists for this week
  let orderFolder = rootFolder;
  try {
    if (cachedLatestRun) {
      const runLabel = formatRunLabel_(cachedLatestRun);
      const folderName = `Prep Run ${runLabel}`;
      const existing = rootFolder.getFoldersByName(folderName);
      if (existing.hasNext()) orderFolder = existing.next();
    }
  } catch (e) {
    Logger.log(`Could not find Prep Run folder — placing in root. ${e.message}`);
  }

  const templateId = getOptionalProp_(CFG.props.templateOrderingCombined);
  let doc;

  if (templateId && templateExists_(templateId)) {
    trashExistingByName_(orderFolder, docTitle);
    doc = copyTemplate_(templateId, orderFolder, docTitle);
    replaceAllPlaceholders_(doc, {
      DATE: sessionDate,
      RUN_LABEL: sessionName,
      STAFF_NAME: countedBy,
    });
    // Remove {{CONTENT}} marker
    const contentMarker = "{{CONTENT}}";
    const sr = doc.getBody().findText(contentMarker);
    if (sr) {
      let parent = sr.getElement().getParent();
      while (parent.getParent() && parent.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
        parent = parent.getParent();
      }
      doc.getBody().removeChild(parent);
    }
  } else {
    trashExistingByName_(orderFolder, docTitle);
    doc = DocumentApp.create(docTitle);
    moveToFolder_(doc.getId(), orderFolder);
    doc.setName(docTitle);
  }

  const body = doc.getBody();
  if (!templateId || !templateExists_(templateId)) {
    body.clearContent();
    body.appendParagraph(docTitle).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
  }

  // Subtitle lines
  body.appendParagraph(`Counted by: ${countedBy}`).setHeading(DocumentApp.ParagraphHeading.SUBTITLE).setFontFamily("Avenir");
  body.appendParagraph(`Session: ${sessionName}`).setFontFamily("Avenir");

  // Feedback link
  appendFeedbackLink_(body, null, docTitle, "Ordering");

  body.appendParagraph("").setFontFamily("Avenir"); // spacer

  // ── 8. Supplier-grouped bar stock orders ──
  const sortedSuppliers = Array.from(supplierMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  sortedSuppliers.forEach(([supplierName, rows]) => {
    rows.sort((a, b) => a.itemName.localeCompare(b.itemName));

    body.appendParagraph(supplierName).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");

    rows.forEach(r => {
      const displayUnit = (r.unit && r.unit !== "ml") ? ` ${r.unit}` : "x Bottles";
      const line = `${r.itemName}  |  ${fmtQty_(r.combinedQty)}${displayUnit}`;
      const li = appendBullet_(body, line);
      li.setFontFamily("Avenir");

      // Bold the order quantity
      const boldText = `${fmtQty_(r.combinedQty)}${displayUnit}`;
      appendTextWithBoldUnderline_(li, line, boldText);
    });
  });

  // ── 9. Items below par — no supplier assigned ──
  if (noSupplierRows.length) {
    noSupplierRows.sort((a, b) => a.itemName.localeCompare(b.itemName));
    body.appendParagraph("").setFontFamily("Avenir");
    body.appendParagraph("ITEMS BELOW PAR — NO SUPPLIER").setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");

    noSupplierRows.forEach(r => {
      const displayUnit = (r.unit && r.unit !== "ml") ? ` ${r.unit}` : "x Bottles";
      const line = `${r.itemName}  |  ${fmtQty_(r.combinedQty)}${displayUnit}`;
      const li = appendBullet_(body, line);
      li.setFontFamily("Avenir");
    });
  }

  // ── 9b/9c. Staff-specific prep orders (supplier-grouped) ──
  // Shared renderer for staff prep sections
  function renderStaffPrepSection_(body, sectionTitle, subtitle, groups) {
    body.appendParagraph("").setFontFamily("Avenir");
    body.appendParagraph(sectionTitle).setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
    body.appendParagraph(subtitle).setFontFamily("Avenir");

    const sortedSuppliers = Array.from(groups.grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    sortedSuppliers.forEach(([supplierName, rows]) => {
      rows.sort((a, b) => a.itemName.localeCompare(b.itemName));
      body.appendParagraph(supplierName).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");

      rows.forEach(r => {
        const displayUnit = (r.unit && r.unit !== "ml") ? ` ${r.unit}` : "x Bottles";
        const line = `${r.itemName}  |  ${fmtQty_(r.qty)}${displayUnit}`;
        const li = appendBullet_(body, line);
        li.setFontFamily("Avenir");
        const boldText = `${fmtQty_(r.qty)}${displayUnit}`;
        appendTextWithBoldUnderline_(li, line, boldText);
      });
    });

    if (groups.noSupplier.length) {
      groups.noSupplier.sort((a, b) => a.itemName.localeCompare(b.itemName));
      body.appendParagraph("NO SUPPLIER").setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily("Avenir");
      groups.noSupplier.forEach(r => {
        const displayUnit = (r.unit && r.unit !== "ml") ? ` ${r.unit}` : "x Bottles";
        const line = `${r.itemName}  |  ${fmtQty_(r.qty)}${displayUnit}`;
        const li = appendBullet_(body, line);
        li.setFontFamily("Avenir");
        const boldText = `${fmtQty_(r.qty)}${displayUnit}`;
        appendTextWithBoldUnderline_(li, line, boldText);
      });
    }
  }

  if (andieRows.length) {
    renderStaffPrepSection_(body,
      "ANDIE'S ORDERS (from Prep Count)",
      "These items are sourced from the prep count and ordered by Andie. Items already in the stock count above are excluded.",
      andieGroups);
  }

  if (bladeRows.length) {
    renderStaffPrepSection_(body,
      "BLADE'S ORDERS (from Prep Count)",
      "These items are sourced from the prep count and ordered by Blade.",
      bladeGroups);
  }

  // ── 10. Prep-only items (non-bar-stock from Ingredient Requirements, excluding Blade) ──
  if (otherPrepRows.length) {
    otherPrepRows.sort((a, b) => a.itemName.localeCompare(b.itemName));
    body.appendParagraph("").setFontFamily("Avenir");
    body.appendParagraph("PREP-ONLY ITEMS (no bar stock count)").setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily("Avenir");
    body.appendParagraph("These items are needed for prep but are not tracked in bar stock.").setFontFamily("Avenir");

    otherPrepRows.forEach(r => {
      const displayUnit = (r.unit && r.unit !== "ml") ? ` ${r.unit}` : "x Bottles";
      const line = `${r.itemName}  |  ${fmtQty_(r.qty)}${displayUnit}` +
        (r.supplier ? `  |  Supplier: ${r.supplier}` : "");
      const li = appendBullet_(body, line);
      li.setFontFamily("Avenir");

      const boldText = `${fmtQty_(r.qty)}${displayUnit}`;
      appendTextWithBoldUnderline_(li, line, boldText);
    });
  }

  // ── 11. Empty state ──
  if (!supplierMap.size && !noSupplierRows.length && !andieRows.length && !bladeRows.length && !otherPrepRows.length) {
    body.appendParagraph("No ordering lines found.").setFontFamily("Avenir");
  }

  doc.saveAndClose();

  const docUrl = docUrl_(doc.getId());
  Logger.log(`✅ Combined ordering doc created: ${docUrl}`);

  // ── 12. Slack notification to Evan ──
  if (!SKIP_SLACK) {
    try {
      const evWebhook = getSlackWebhook_(CFG.props.slackWaratahTest);
      const slackText =
        `*Ordering Run Sheet — ${sessionName}*\n` +
        `• ${slackLink_(docUrl, docTitle)}\n` +
        `Counted by: ${countedBy}  |  ${supplierMap.size} suppliers  |  ${andieRows.length} Andie items  |  ${bladeRows.length} Blade items  |  ${otherPrepRows.length} prep-only items`;
      postToSlack_(evWebhook, slackText);
    } catch (e) {
      Logger.log(`Slack warning (ordering): ${e.message} — continuing without notification.`);
    }
  }

  return {
    docId: doc.getId(),
    docUrl,
    docTitle,
    sessionId: session.id,
    sessionName,
    supplierCount: supplierMap.size,
    barStockOrderCount: orders.length,
    andieItemCount: andieRows.length,
    bladeItemCount: bladeRows.length,
    prepOnlyCount: otherPrepRows.length,
  };
}

/**
 * Compute "DD/MM/YYYY" week-ending label from a session date string.
 * Week ends on Sunday (session date is a Monday, so +6 days).
 */
function computeWeekEndingFromDate_(dateStr) {
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 6);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch (e) {
    return "";
  }
}

/* =========================================================
 * AIRTABLE CORE
 * ======================================================= */

function getLatestRunWithData_() {
  const runs = airtableListAll_(CFG.airtable.tables.runs, {
    fields: [
      CFG.airtable.fields.runPrepWeek,
      CFG.airtable.fields.runNotes,
      CFG.airtable.fields.runTasksLinkBack,
      CFG.airtable.fields.runReqsLinkBack,
      CFG.airtable.fields.runLinkToGuides,
    ],
    pageSize: 50,
  });

  if (!runs.length) return null;

  const withData = runs.filter((r) => {
    const t = r.fields[CFG.airtable.fields.runTasksLinkBack];
    const q = r.fields[CFG.airtable.fields.runReqsLinkBack];
    return (Array.isArray(t) && t.length) || (Array.isArray(q) && q.length);
  });

  const pool = withData.length ? withData : runs;
  pool.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
  return pool[0];
}

function getRunById_(runId) {
  if (!runId) return null;

  const recs = airtableGetByIds_(CFG.airtable.tables.runs, [runId], [
    CFG.airtable.fields.runPrepWeek,
    CFG.airtable.fields.runNotes,
    CFG.airtable.fields.runTasksLinkBack,
    CFG.airtable.fields.runReqsLinkBack,
    CFG.airtable.fields.runLinkToGuides,
  ]);

  return recs[0] || null;
}

function airtableGetByIds_(tableName, ids, fields) {
  const out = [];
  const groups = Array.isArray(ids) ? chunk_(ids, 20) : chunk_([ids], 20);

  groups.forEach((group) => {
    const formula = "OR(" + group.map((id) => `RECORD_ID()="${id}"`).join(",") + ")";
    const opts = { filterByFormula: formula, pageSize: 100 };
    if (Array.isArray(fields) && fields.length) opts.fields = fields;
    const recs = airtableListAll_(tableName, opts);
    out.push(...recs);
  });

  return out;
}

function airtableListAll_(tableName, opts) {
  let offset = null;
  const records = [];

  do {
    const params = Object.assign({}, opts || {});
    if (offset) params.offset = offset;
    const res = airtableGet_(tableName, params);
    records.push(...(res.records || []));
    offset = res.offset || null;
  } while (offset);

  return records;
}

function airtableGet_(tableName, params) {
  const baseId = getAirtableBaseId_();
  const pat = getAirtablePat_();
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${query_(params || {})}`;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: `Bearer ${pat}` },
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) throw new Error(`Airtable GET failed (${code}): ${text}`);
  return JSON.parse(text);
}

function airtablePatch_(tableName, recordId, fields) {
  const baseId = getAirtableBaseId_();
  const pat = getAirtablePat_();
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;

  const resp = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${pat}` },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) throw new Error(`Airtable PATCH failed (${code}): ${text}`);
  return JSON.parse(text);
}

/* =========================================================
 * DRIVE SHARING + FILE HELPERS
 * ======================================================= */

function setRunFolderSharing_(folder) {
  try {
    folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    return;
  } catch (e) {}

  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}
}

function trashExistingByName_(folder, name) {
  const files = folder.getFilesByName(name);
  while (files.hasNext()) files.next().setTrashed(true);
}

function moveToFolder_(fileId, folder) {
  const file = DriveApp.getFileById(fileId);
  folder.addFile(file);
  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (e) {}
}

/* =========================================================
 * UTILITIES
 * ======================================================= */

function getAirtableBaseId_() {
  const v = getProp_(CFG.props.airtableBaseId);
  if (!v.startsWith("app") && !v.startsWith("wsp")) throw new Error(`AIRTABLE_BASE_ID looks wrong: ${v}`);
  if (v.includes("/") || v.includes("airtable.com")) throw new Error(`AIRTABLE_BASE_ID must be just the base id: ${v}`);
  return v;
}

function getAirtablePat_() {
  const v = getProp_(CFG.props.airtablePat);
  if (!v.startsWith("pat")) throw new Error("AIRTABLE_PAT looks wrong (should start with 'pat').");
  if (/\s/.test(v)) throw new Error("AIRTABLE_PAT contains whitespace/newlines. Re-paste it cleanly.");
  if (v.toLowerCase().includes("bearer")) throw new Error("AIRTABLE_PAT should be the raw token only (no 'Bearer ').");
  return v;
}

function getDocsFolderId_() {
  const v = getProp_(CFG.props.docsFolderId);
  if (v.startsWith("app")) throw new Error(`DOCS_FOLDER_ID looks wrong: ${v}`);
  if (v.includes("/") || v.includes("drive.google.com")) throw new Error(`DOCS_FOLDER_ID must be just the folder id: ${v}`);
  return v;
}

function getProp_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v || !String(v).trim()) throw new Error(`Missing Script Property: ${name}`);
  return String(v).trim();
}

function query_(obj) {
  const parts = [];
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v == null) return;

    if (Array.isArray(v)) {
      const key = k.endsWith("[]") ? k : `${k}[]`;
      v.forEach((x) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(x)}`));
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  });
  return parts.join("&");
}

function chunk_(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function indexById_(records) {
  const out = {};
  records.forEach((r) => (out[r.id] = r));
  return out;
}

function firstId_(cell) {
  if (!cell || !Array.isArray(cell) || !cell.length) return null;
  return cell[0];
}

function num_(v) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cellToText_(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    const parts = v.map(cellToText_).filter(Boolean);
    return [...new Set(parts)].join(", ");
  }

  if (typeof v === "object") {
    if (typeof v.name === "string") return v.name;
    return JSON.stringify(v);
  }

  return String(v);
}

function firstNonEmpty_(values) {
  for (const v of values) {
    const s = cellToText_(v).trim();
    if (s) return s;
  }
  return "";
}

function normaliseItemType_(t) {
  const s = (t || "").trim();
  if (s === "Sub-recipe") return "Sub Recipe";
  return s;
}

function formatRunLabel_(run) {
  const prepWeek = run.fields[CFG.airtable.fields.runPrepWeek];
  const dt = prepWeek ? new Date(prepWeek) : new Date(run.createdTime);
  return Utilities.formatDate(dt, CFG.timezone, "yyyy-MM-dd");
}

function formatRunDateLong_(run) {
  const prepWeek = run.fields[CFG.airtable.fields.runPrepWeek];
  const dt = prepWeek ? new Date(prepWeek) : new Date(run.createdTime);
  return Utilities.formatDate(dt, CFG.timezone, "EEEE, d MMMM yyyy");
}

function formatWeekEndingLabel_(run) {
  const prepWeek = run.fields[CFG.airtable.fields.runPrepWeek];
  const dt = prepWeek ? new Date(prepWeek) : new Date(run.createdTime);
  const sunday = new Date(dt.getTime() + 6 * 24 * 60 * 60 * 1000);
  return "W.E. " + Utilities.formatDate(sunday, CFG.timezone, "dd/MM/yyyy");
}

function formatNow_() {
  return Utilities.formatDate(new Date(), CFG.timezone, "yyyy-MM-dd HH:mm");
}

function fmtQty_(n) {
  if (!Number.isFinite(n)) return "";
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? String(Math.round(n)) : n.toFixed(2).replace(/\.00$/, "");
}

/* =========================================================
 * POLL-BASED EXPORT PROCESSOR
 * ======================================================= */

function processPrepRunExportRequests() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("Another export is running. Skipping.");
    return;
  }

  const TABLE = CFG.airtable.tables.runs;

  const F = {
    state: "Export Request State",
    mode: "Export Mode",
    notify: "Export Notify Slack",
    requestedAt: "Export Requested At",
    lastError: "Export Last Error",
    finishedAt: "Export Finished At",
    lastResult: "Export Last Result",
  };

  try {
    const requested = airtableListAll_(TABLE, {
      fields: [F.state, F.mode, F.notify, F.requestedAt, F.lastError, F.finishedAt, F.lastResult],
      filterByFormula: `{${F.state}}="REQUESTED"`,
      pageSize: 50,
    });

    if (!requested.length) {
      Logger.log("No REQUESTED exports found.");
      return;
    }

    requested.sort((a, b) => {
      const ta = new Date(a.fields?.[F.requestedAt] || a.createdTime).getTime();
      const tb = new Date(b.fields?.[F.requestedAt] || b.createdTime).getTime();
      return ta - tb;
    });

    for (const run of requested) {
      const runId = run.id;
      const mode = String(run.fields?.[F.mode] || "LIVE").toUpperCase();
      const notifySlack = run.fields?.[F.notify] === true;

      airtablePatch_(TABLE, runId, {
        [F.state]: "IN_PROGRESS",
        [F.lastError]: "",
      });

      try {
        const result = exportPrepRunToDocsForRunId_(runId, {
          test: mode === "TEST",
          notifySlack,
        });

        airtablePatch_(TABLE, runId, {
          [F.state]: "DONE",
          [F.finishedAt]: new Date().toISOString(),
          [F.lastResult]: safeJson_(result, 90000),
        });

      } catch (err) {
        airtablePatch_(TABLE, runId, {
          [F.state]: "FAILED",
          [F.finishedAt]: new Date().toISOString(),
          [F.lastError]: String(err && err.message ? err.message : err),
        });
      }
    }

  } finally {
    lock.releaseLock();
  }
}

function safeJson_(obj, maxLen) {
  let s = "";
  try { s = JSON.stringify(obj); } catch (e) { s = String(obj); }
  if (!maxLen || s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}

/* =========================================================
 * POLL-BASED ORDERING EXPORT PROCESSOR
 *
 * Polls Count Sessions for "Ordering Export State" = "REQUESTED".
 * When found, generates the Combined Ordering Run Sheet and sets
 * the state to "COMPLETED" (or "ERROR" on failure).
 *
 * Set up a GAS time-driven trigger to run this every 1-2 minutes.
 * ======================================================= */

function processOrderingExportRequests() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("Another export is running. Skipping ordering poll.");
    return;
  }

  const T = CFG.airtable.tables;
  const F = CFG.airtable.fields;

  try {
    const requested = airtableListAll_(T.countSessions, {
      fields: [F.csStatus, F.csDate, F.csOrderingExportState],
      filterByFormula: `{${F.csOrderingExportState}}="REQUESTED"`,
      pageSize: 10,
    });

    if (!requested.length) {
      Logger.log("No REQUESTED ordering exports found.");
      return;
    }

    // Process the most recent one only
    requested.sort((a, b) => {
      const da = a.fields?.[F.csDate] || "";
      const db = b.fields?.[F.csDate] || "";
      return db.localeCompare(da);
    });

    const session = requested[0];
    const sessionId = session.id;
    const sessionDate = session.fields?.[F.csDate] || "(unknown)";

    Logger.log(`Processing ordering export for session ${sessionDate} (${sessionId})`);

    let exportSuccess = false;
    try {
      // Route Slack to the test channel for ordering notifications
      SLACK_WEBHOOK_OVERRIDE = getSlackWebhook_(CFG.props.slackWaratahTest);

      const result = exportCombinedOrderingDoc_();
      exportSuccess = true;
      Logger.log(`Ordering doc generated for session ${sessionDate}`);

    } catch (err) {
      const errorMsg = err && err.message ? err.message : String(err);
      Logger.log(`Ordering export FAILED for session ${sessionDate}: ${errorMsg}`);

    } finally {
      SLACK_WEBHOOK_OVERRIDE = null;
    }

    // Update state — try { name: "X" } first, fall back to plain string
    const newState = exportSuccess ? "COMPLETED" : "ERROR";
    try {
      airtablePatch_(T.countSessions, sessionId, {
        [F.csOrderingExportState]: { name: newState },
      });
      Logger.log(`Set Ordering Export State → ${newState}`);
    } catch (patchErr1) {
      Logger.log(`Patch with {name} failed: ${patchErr1.message} — trying plain string`);
      try {
        airtablePatch_(T.countSessions, sessionId, {
          [F.csOrderingExportState]: newState,
        });
        Logger.log(`Set Ordering Export State → ${newState} (plain string)`);
      } catch (patchErr2) {
        Logger.log(`Patch with plain string also failed: ${patchErr2.message} — state not updated`);
      }
    }

  } finally {
    lock.releaseLock();
  }
}
