/****************************************************
 * SAKURA HOUSE PREP SYSTEM — MAIN ENTRY POINTS
 * Part of the GoogleDocsPrepSystem split (GoogleDocsPrepSystem.gs)
 * Web app endpoints, export orchestration, Slack, polling
 *
 * VERSION 4.2 — HYBRID TEMPLATE ENGINE
 *
 * Companion files (all in GAS global namespace):
 *   PrepConfig.gs        — CFG object + global override vars
 *   PrepUtils.gs         — Airtable REST, Drive helpers, pure utilities
 *   PrepDocFormatting.gs  — Template engine + formatting helpers
 *   PrepDocGenerators.gs  — Ordering, Batching, Ingredient Prep doc creators
 *
 * Outputs (4 Docs):
 * 1) Ingredient Prep List (Sub Recipe tasks grouped by Batch)
 * 2) Batching List (Batch tasks with ingredient bullets + method)
 * 3) Gooch Ordering List (Supplier headings + bullets)
 * 4) Sabs Ordering List  (Supplier headings + bullets)
 *
 * REQUIRED SCRIPT PROPERTIES:
 * - AIRTABLE_BASE_ID
 * - AIRTABLE_PAT
 * - DOCS_FOLDER_ID
 * - SLACK_WEBHOOK_KALISHA  (all 4 docs)
 * - SLACK_WEBHOOK_EVAN     (all 4 docs)
 * - SLACK_WEBHOOK_GOOCH    (all 4 docs)
 * - SLACK_WEBHOOK_SABS     (all 4 docs)
 * - SLACK_WEBHOOK_PREP     (Ingredient Prep List + Batching List only)
 * - SLACK_WEBHOOK_EV_TEST  (optional, for TEST mode — all docs to one channel)
 * - MANUAL_TRIGGER_SECRET  (optional, for webhook triggers)
 * - RECIPE_SCALER_URL      (optional, deployed web app URL for Recipe Scaler)
 * - TEMPLATE_ORDERING_ID   (optional, for branded templates)
 * - TEMPLATE_BATCHING_ID   (optional, for branded templates)
 * - TEMPLATE_INGREDIENT_PREP_ID (optional, for branded templates)
 ****************************************************/

/* =========================================================
 * WEB APP ROUTER (doGet)
 * Routes to either Feedback Form or Recipe Scaler based on 'page' parameter
 * ======================================================= */

/**
 * Unified doGet router for web app deployments
 * Routes based on 'page' URL parameter:
 * - page=scaler -> Recipe Scaler
 * - page=feedback (or default) -> Feedback Form
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

function debugAirtableConnection() {
  const baseId = getAirtableBaseId_();
  const pat = getAirtablePat_();

  Logger.log("==== PROPS CHECK ====");
  Logger.log({
    AIRTABLE_BASE_ID: baseId,
    baseIdLooksCorrect: baseId.startsWith("app") && baseId.length > 10,
    AIRTABLE_PAT_prefix: pat.slice(0, 6),
    patLooksCorrect: pat.startsWith("pat"),
    DOCS_FOLDER_ID: getDocsFolderId_(),
    MANUAL_TRIGGER_SECRET_set: !!PropertiesService.getScriptProperties().getProperty(CFG.props.manualTriggerSecret),
    TEMPLATE_ORDERING_ID: getOptionalProp_(CFG.props.templateOrdering) || "(not set)",
    TEMPLATE_BATCHING_ID: getOptionalProp_(CFG.props.templateBatching) || "(not set)",
    TEMPLATE_INGREDIENT_PREP_ID: getOptionalProp_(CFG.props.templateIngredientPrep) || "(not set)",
  });

  Logger.log("==== SIMPLE TABLE GETS ====");
  const tests = [
    CFG.airtable.tables.items,
    CFG.airtable.tables.runs,
    CFG.airtable.tables.tasks,
    CFG.airtable.tables.reqs,
    CFG.airtable.tables.recipeLines,
    CFG.airtable.tables.supplier,
  ];

  tests.forEach((t) => {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(t)}?maxRecords=1`;
    const resp = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: `Bearer ${pat}` },
      muteHttpExceptions: true,
    });
    Logger.log(`${t}: HTTP ${resp.getResponseCode()} → ${resp.getContentText()}`);
  });
}

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
  const runDateShort = formatRunDateShort_(run);

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
        CFG.airtable.fields.reqOrderSize,
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
          CFG.airtable.fields.recipeName,
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

  const batchTasks = [];
  const subTasksByItemId = {};

  tasks.forEach((t) => {
    const itemId = firstId_(t.fields[CFG.airtable.fields.taskItem]);
    if (!itemId || !itemsById[itemId]) return;

    const item = itemsById[itemId];
    const itemName = item.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)";
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
      recipeName: recipe ? (recipe.fields[CFG.airtable.fields.recipeName] || "") : "",
      method: recipe ? (recipe.fields[CFG.airtable.fields.recipeMethod] || "") : "",
      notes: (t.fields[CFG.airtable.fields.taskNotes] || "").trim(),
    };

    if (itemType === CFG.airtable.itemTypes.batch) {
      batchTasks.push(taskObj);
    } else if (CFG.airtable.itemTypes.subRecipeVariants.has(itemType)) {
      subTasksByItemId[itemId] = taskObj;
    }
  });

  // Filter out tasks with no meaningful target quantity
  const filteredBatchTasks = batchTasks.filter(t =>
    Number.isFinite(t.targetQty) && t.targetQty > 0
  );
  filteredBatchTasks.sort((a, b) => a.itemName.localeCompare(b.itemName));

  // Also filter subTasks
  Object.keys(subTasksByItemId).forEach(key => {
    const task = subTasksByItemId[key];
    if (!Number.isFinite(task.targetQty) || task.targetQty <= 0) {
      delete subTasksByItemId[key];
    }
  });

  const ingredientTitle = `Ingredient Prep List ${runDateShort}`;
  const batchingTitle = `Batching List ${runDateShort}`;
  const goochTitle = `Gooch Ordering List ${runDateShort}`;
  const sabsTitle = `Sabs Ordering List ${runDateShort}`;

  const ingredientDocId = createIngredientPrepDoc_(
    runFolder, ingredientTitle, runDateFormatted, runLabel,
    filteredBatchTasks, subTasksByItemId, linesByRecipeId, itemsById,
    run.id
  );

  const batchingDocId = createBatchingDoc_(
    runFolder, batchingTitle, runDateFormatted, runLabel,
    filteredBatchTasks, linesByRecipeId, itemsById,
    run.id
  );

  const ordering = buildOrdering_(reqs, itemsById, suppliersById);

  const goochDocId = createOrderingDoc_(
    runFolder, goochTitle, runDateFormatted, runLabel, "GOOCH", ordering.gooch,
    run.id
  );

  const sabsDocId = createOrderingDoc_(
    runFolder, sabsTitle, runDateFormatted, runLabel, "SABS", ordering.sabs,
    run.id
  );

  const runFolderUrl = runFolder.getUrl();

  airtablePatch_(CFG.airtable.tables.runs, run.id, {
    [CFG.airtable.fields.runLinkToGuides]: runFolderUrl,
  });

  postPrepRunToSlack_({
    runLabel,
    runFolderUrl,
    ingredientDoc: { title: ingredientTitle, url: docUrl_(ingredientDocId) },
    batchingDoc: { title: batchingTitle, url: docUrl_(batchingDocId) },
    goochDoc: { title: goochTitle, url: docUrl_(goochDocId) },
    sabsDoc: { title: sabsTitle, url: docUrl_(sabsDocId) },
  });

  const result = {
    runId: run.id,
    runLabel,
    folderUrl: runFolderUrl,
    docs: {
      ingredient: { title: ingredientTitle, url: docUrl_(ingredientDocId) },
      batching: { title: batchingTitle, url: docUrl_(batchingDocId) },
      gooch: { title: goochTitle, url: docUrl_(goochDocId) },
      sabs: { title: sabsTitle, url: docUrl_(sabsDocId) },
    },
  };

  Logger.log("✅ Export complete");
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function exportLatestPrepRunToDocs_TEST() {
  SLACK_WEBHOOK_OVERRIDE = getSlackWebhook_(CFG.props.slackEvTest);
  try {
    return exportLatestPrepRunToDocs();
  } finally {
    SLACK_WEBHOOK_OVERRIDE = null;
  }
}

/* =========================================================
 * SLACK
 * ======================================================= */

function postPrepRunToSlack_({ runLabel, runFolderUrl, ingredientDoc, batchingDoc, goochDoc, sabsDoc }) {
  if (SKIP_SLACK) return;

  const folderLink = slackLink_(runFolderUrl, `Prep Run ${runLabel} folder`);

  // Full message: all 4 docs (sent to each individual)
  const fullText =
    `*Prep Run ${runLabel}*\n` +
    `• ${slackLink_(goochDoc.url, "Gooch Ordering List")}\n` +
    `• ${slackLink_(sabsDoc.url, "Sabs Ordering List")}\n` +
    `• ${slackLink_(ingredientDoc.url, "Ingredient Prep List")}\n` +
    `• ${slackLink_(batchingDoc.url, "Batching List")}\n` +
    `• ${folderLink}`;

  // Prep-only message: just prep docs (sent to Prep channel)
  const prepOnlyText =
    `*Prep Run ${runLabel}*\n` +
    `• ${slackLink_(ingredientDoc.url, "Ingredient Prep List")}\n` +
    `• ${slackLink_(batchingDoc.url, "Batching List")}\n` +
    `• ${folderLink}`;

  if (SLACK_WEBHOOK_OVERRIDE) {
    // TEST mode: send everything to a single test webhook
    const testText = `*Prep Run ${runLabel} — TEST (Evan)*\n` + fullText.split("\n").slice(1).join("\n");
    postToSlack_(SLACK_WEBHOOK_OVERRIDE, testText);
    return;
  }

  // LIVE mode notifications:
  // Kalisha, Evan, Gooch, Sabs → all 4 docs
  // Prep Channel              → Ingredient Prep List + Batching List only
  const webhooks = [
    { prop: CFG.props.slackKalisha, text: fullText },
    { prop: CFG.props.slackEvan,    text: fullText },
    { prop: CFG.props.slackGooch,   text: fullText },
    { prop: CFG.props.slackSabs,    text: fullText },
    { prop: CFG.props.slackPrep,    text: prepOnlyText },
  ];

  webhooks.forEach(({ prop, text }, i) => {
    if (i > 0) Utilities.sleep(250);
    tryPostToSlack_(getSlackWebhook_(prop), text, prop);
  });
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
    return true;
  } catch (e) {
    Logger.log(`Slack ${label || "post"} failed (non-fatal): ${e.message}`);
    return false;
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
