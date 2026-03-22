/****************************************************
 * INTEGRATED PREP → GOOGLE DOCS EXPORTER (4 DOCS + SLACK)
 * VERSION 4.2 — HYBRID TEMPLATE ENGINE
 *
 * Split into 5 files (all deploy as one GAS namespace):
 *   PrepConfig.gs         — CFG object + global override vars
 *   PrepUtils.gs          — Airtable REST API, Drive helpers, utilities
 *   PrepDocFormatting.gs  — Template engine + formatting helpers
 *   PrepDocGenerators.gs  — All document generators
 *   GoogleDocsPrepSystem.gs — THIS FILE: orchestrator, Slack, polling, healthCheck
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
    Logger.log("doPost error: " + (err.stack || err.message || String(err)));
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "Internal error" }))
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
  // See exportCombinedOrderingDoc_() in PrepDocGenerators.gs.

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

    // Set IN_PROGRESS before doing work — prevents duplicate processing on timeout
    try {
      airtablePatch_(T.countSessions, sessionId, {
        [F.csOrderingExportState]: { name: "IN_PROGRESS" },
      });
    } catch (progressErr) {
      Logger.log(`Failed to set IN_PROGRESS (trying plain string): ${progressErr.message}`);
      try {
        airtablePatch_(T.countSessions, sessionId, {
          [F.csOrderingExportState]: "IN_PROGRESS",
        });
      } catch (progressErr2) {
        Logger.log(`IN_PROGRESS update failed entirely: ${progressErr2.message}`);
      }
    }

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

// =============================================================================
// HEALTH CHECK — Polling Failure Alerting
// =============================================================================

/**
 * Checks that GAS polling triggers exist and no export requests are stalled.
 * Set up as a separate GAS time-driven trigger (every 30 minutes).
 *
 * Alerts to SLACK_WEBHOOK_EV_TEST if:
 *   - Expected polling triggers are missing
 *   - Any record has been in REQUESTED state for >15 minutes
 *
 * Disable via Script Property: HEALTH_CHECK_ENABLED=false
 */
function healthCheck() {
  const enabled = getOptionalProp_("HEALTH_CHECK_ENABLED");
  if (enabled === "false") {
    Logger.log("Health check disabled via HEALTH_CHECK_ENABLED=false");
    return;
  }

  const alerts = [];

  // --- Check 1: Verify polling triggers exist ---
  const triggers = ScriptApp.getProjectTriggers();
  const triggerFunctions = triggers.map(t => t.getHandlerFunction());

  const expectedPollers = ["processPrepRunExportRequests", "processOrderingExportRequests"];
  for (const fn of expectedPollers) {
    if (!triggerFunctions.includes(fn)) {
      alerts.push(`MISSING TRIGGER: \`${fn}\` — no time-driven trigger found. Export requests will not be processed.`);
    }
  }

  // --- Check 2: Check for stalled REQUESTED records (Prep Runs) ---
  try {
    const baseId = getAirtableBaseId_();
    const pat = getAirtablePat_();
    const stalledMinutes = 15;

    // Check Prep Runs with REQUESTED state
    const runsFilter = encodeURIComponent('{Export Request State}="REQUESTED"');
    const runsUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(CFG.airtable.tables.runs)}?filterByFormula=${runsFilter}`;
    const runsResp = UrlFetchApp.fetch(runsUrl, {
      headers: { Authorization: `Bearer ${pat}` },
      muteHttpExceptions: true,
    });

    if (runsResp.getResponseCode() === 200) {
      const runs = JSON.parse(runsResp.getContentText()).records || [];
      for (const run of runs) {
        const requestedAt = run.fields["Export Requested At"];
        if (requestedAt) {
          const ageMs = Date.now() - new Date(requestedAt).getTime();
          const ageMin = Math.round(ageMs / 60000);
          if (ageMin > stalledMinutes) {
            alerts.push(`STALLED PREP RUN: "${run.fields[CFG.airtable.fields.runPrepWeek] || run.id}" has been REQUESTED for ${ageMin} minutes (threshold: ${stalledMinutes}min).`);
          }
        }
      }
    }

    // Check Count Sessions with REQUESTED ordering export state
    const sessFilter = encodeURIComponent('{Ordering Export State}="REQUESTED"');
    const sessUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(CFG.airtable.tables.countSessions)}?filterByFormula=${sessFilter}`;
    const sessResp = UrlFetchApp.fetch(sessUrl, {
      headers: { Authorization: `Bearer ${pat}` },
      muteHttpExceptions: true,
    });

    if (sessResp.getResponseCode() === 200) {
      const sessions = JSON.parse(sessResp.getContentText()).records || [];
      if (sessions.length > 0) {
        alerts.push(`STALLED ORDERING: ${sessions.length} Count Session(s) stuck in REQUESTED state. Check GAS triggers.`);
      }
    }
  } catch (e) {
    alerts.push(`HEALTH CHECK ERROR: Could not query Airtable — ${e.message}`);
  }

  // --- Report ---
  if (alerts.length === 0) {
    Logger.log("Health check PASSED — all triggers present, no stalled requests.");
    return;
  }

  const alertText = `🚨 *[Waratah] PREP System Health Check Alert*\n\n${alerts.map(a => `• ${a}`).join("\n")}\n\n_Check GAS project triggers and Airtable records._`;
  Logger.log(`Health check FAILED:\n${alerts.join("\n")}`);

  try {
    const webhook = getSlackWebhook_(CFG.props.slackEvTest);
    postToSlack_(webhook, alertText);
    Logger.log("Alert sent to Slack.");
  } catch (e) {
    Logger.log(`Could not send Slack alert: ${e.message}`);
  }
}
