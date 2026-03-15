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

const CFG = {
  timezone: "Australia/Sydney",

  props: {
    airtableBaseId: "AIRTABLE_BASE_ID",
    airtablePat: "AIRTABLE_PAT",
    docsFolderId: "DOCS_FOLDER_ID",

    slackKalisha: "SLACK_WEBHOOK_KALISHA",
    slackEvan: "SLACK_WEBHOOK_EVAN",
    slackGooch: "SLACK_WEBHOOK_GOOCH",
    slackSabs: "SLACK_WEBHOOK_SABS",
    slackPrep: "SLACK_WEBHOOK_PREP",
    slackEvTest: "SLACK_WEBHOOK_EV_TEST",
    manualTriggerSecret: "MANUAL_TRIGGER_SECRET",
    recipeScalerUrl: "RECIPE_SCALER_URL",

    templateOrdering: "TEMPLATE_ORDERING_ID",
    templateBatching: "TEMPLATE_BATCHING_ID",
    templateIngredientPrep: "TEMPLATE_INGREDIENT_PREP_ID",
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
      reqOrderSize: "Order Size (Lookup)",

      itemName: "Item Name",
      itemType: "Item Type",
      itemUnit: "Unit",

      recipeName: "Recipe Name",
      recipeMethod: "Method",

      rlRecipe: "Recipe",
      rlItem: "Item",
      rlQty: "Qty",

      supplierName: "Supplier Name",
      supplierOrderingStaff: "Ordering Staff",
      supplierEmail: "Email",
    },

    itemTypes: {
      batch: "Batch",
      subRecipeVariants: new Set(["Sub Recipe", "Sub-recipe"]),
    },

    staffAliases: {
      gooch: ["gooch"],
      sabs: ["sabs", "sabine"],
    },
  },

  bufferMultiplier: 1.5,
  negligibleRatioThreshold: 0.05, // Items using ≤5% of their order unit size are flagged as negligible
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
 * ORDERING DOC (TEMPLATE-FIRST)
 * ======================================================= */

function createOrderingDoc_(folder, title, dateFormatted, runLabel, staffName, data, runId) {
  const templateId = getOptionalProp_(CFG.props.templateOrdering);
  const staffRole = staffName === "GOOCH" ? "Ordering - Gooch" : staffName === "SABS" ? "Ordering - Sabs" : "Ordering";

  if (templateId && templateExists_(templateId)) {
    try {
      return createOrderingDocFromTemplate_(folder, title, dateFormatted, runLabel, staffName, data, templateId, runId, staffRole);
    } catch (e) {
      Logger.log(`Template processing failed for Ordering doc: ${e.message}. Falling back to programmatic.`);
      Logger.log(e.stack);
    }
  } else {
    Logger.log("Template not found for Ordering doc, using programmatic fallback.");
  }

  return createOrReplaceOrderingDoc_(folder, title, dateFormatted, staffName, data, runId, staffRole);
}

/**
 * HYBRID TEMPLATE APPROACH (v4.2)
 * Template provides: header branding, styling, logo
 * Code provides: all dynamic content (suppliers, items, etc.)
 *
 * Template should contain:
 * - Header with {{DATE}}, {{RUN_LABEL}}, {{STAFF_NAME}} placeholders
 * - A {{CONTENT}} marker where dynamic content will be inserted
 * - Any footer/branding elements
 */
function createOrderingDocFromTemplate_(folder, title, dateFormatted, runLabel, staffName, data, templateId, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = copyTemplate_(templateId, folder, title);
  const body = doc.getBody();

  // Replace header placeholders
  replaceAllPlaceholders_(doc, {
    DATE: dateFormatted,
    RUN_LABEL: runLabel,
    STAFF_NAME: staffName,
  });

  // Find and remove {{CONTENT}} marker, get insertion point
  const contentMarker = "{{CONTENT}}";
  const searchResult = body.findText(contentMarker);
  let insertIndex = body.getNumChildren(); // Default: append at end

  if (searchResult) {
    const element = searchResult.getElement();
    let parent = element.getParent();
    while (parent.getParent() && parent.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
      parent = parent.getParent();
    }
    insertIndex = body.getChildIndex(parent);
    body.removeChild(parent);
  }

  // Remove any pre-existing "NEEDS ASSIGNMENT" sections from template
  // (template should only have header branding, not content)
  removeElementsContainingText_(body, "NEEDS ASSIGNMENT");
  removeElementsContainingText_(body, "need supplier/staff assignment");

  // Insert feedback link at the top of content
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

  // Now append content programmatically (same logic as fallback)
  const suppliers = data?.suppliers || [];
  const needsRouting = data?.needsRouting || [];

  if (!suppliers.length && !needsRouting.length) {
    body.insertParagraph(insertIndex, "No ordering lines found.");
  } else {
    let idx = insertIndex;

    suppliers.forEach((s) => {
      body.insertParagraph(idx++, s.supplierName).setHeading(DocumentApp.ParagraphHeading.HEADING1);

      if (s.supplierEmail && s.supplierEmail.trim()) {
        body.insertParagraph(idx++, s.supplierEmail.trim());
      } else {
        body.insertParagraph(idx++, "Portal or Other");
      }

      (s.lines || []).forEach((l) => {
        const bulletText = `${l.itemName} ${formatQtyWithBuffer_(l.qty, l.unit)}`.trim();
        const li = body.insertListItem(idx++, bulletText);
        li.setGlyphType(DocumentApp.GlyphType.BULLET);

        const baseQty = `${fmtQty_(l.qty)}${l.unit || ""}`;
        appendTextWithBoldUnderline_(li, bulletText, baseQty);
      });
    });

    // Add unassigned/needs routing items at the END
    if (needsRouting.length) {
      body.insertParagraph(idx++, ""); // Blank line
      body.insertParagraph(idx++, "⚠️ NEEDS ASSIGNMENT").setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.insertParagraph(idx++, "These items need supplier/staff assignment in Airtable:");

      needsRouting.forEach((r) => {
        const bulletText = `${r.supplierName}: ${r.itemName} ${formatQtyWithBuffer_(r.qty, r.unit)}`.trim();
        const li = body.insertListItem(idx++, bulletText);
        li.setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    }

    // Add negligible stock decrements section at the END
    renderNegligibleSection_(body, data?.negligible || [], idx);
  }

  cleanupMarkers_(body);
  doc.saveAndClose();
  return doc.getId();
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

  // Append content programmatically
  // Pre-filter batches that have visible content (at least one ingredient with non-zero qty)
  const visibleBatchTasks = batchTasks.filter((t) => {
    if (!t.recipeId) return false; // No recipe = no ingredients to show
    const lines = linesByRecipeId[t.recipeId] || [];
    if (!lines.length) return false;
    // Check if ANY ingredient has a non-zero total
    return lines.some((ln) => {
      const total = ln.qtyPerBatch * (t.batchesNeeded || 0);
      return Number.isFinite(total) && total > 0;
    });
  });

  if (!visibleBatchTasks.length) {
    body.insertParagraph(insertIndex, "No Batch tasks with ingredients found.");
  } else {
    let idx = insertIndex;

    visibleBatchTasks.forEach((t) => {
      const batchHeader = `${t.itemName} ${formatQtyWithBuffer_(t.targetQty, t.unit)}`.trim();
      const batchPara = body.insertParagraph(idx++, batchHeader);
      batchPara.setHeading(DocumentApp.ParagraphHeading.HEADING1);

      const baseQtyText = `${fmtQty_(t.targetQty)}${t.unit || ""}`;
      appendTextWithBoldUnderline_(batchPara, batchHeader, baseQtyText);

      // Add scaler link if configured
      const scalerLink = getScalerLink_(t.recipeId);
      if (scalerLink) {
        const scalerPara = body.insertParagraph(idx++, "");
        scalerPara.appendText("📐 ").setFontSize(10);
        scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF");
      }

      const lines = linesByRecipeId[t.recipeId] || [];
      lines.forEach((ln) => {
        const comp = itemsById[ln.itemId];
        const compName = comp ? (comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)") : "(Unknown Item)";
        const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

        const total = ln.qtyPerBatch * (t.batchesNeeded || 0);
        if (!Number.isFinite(total) || total === 0) return;

        const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
        const li = body.insertListItem(idx++, bulletText);
        li.setGlyphType(DocumentApp.GlyphType.BULLET);

        const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
        appendTextWithBoldUnderline_(li, bulletText, bulletBaseQty);
      });

      if ((t.method || "").trim()) {
        body.insertParagraph(idx++, "");
        body.insertParagraph(idx++, "Method:").setHeading(DocumentApp.ParagraphHeading.HEADING3);
        const methodLines = String(t.method || "").split(/\r?\n/);
        methodLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) body.insertParagraph(idx++, txt);
        });
      }

      if ((t.notes || "").trim()) {
        body.insertParagraph(idx++, "Notes:").editAsText().setBold(true);
        const noteLines = String(t.notes || "").split(/\r?\n/);
        noteLines.forEach((ln) => {
          const txt = ln.trim();
          if (txt) body.insertParagraph(idx++, txt);
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
  removeElementsContainingText_(body, "No recipe linked");

  // Insert feedback link at the top of content
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

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

  if (!batchesWithSubRecipes.length) {
    body.insertParagraph(insertIndex, "No batches with sub-recipe prep requirements found.");
  } else {
    let idx = insertIndex;
    const printedSub = new Set();

    batchesWithSubRecipes.forEach((batch) => {
      const batchHeader = `${batch.itemName} ${formatQtyWithBuffer_(batch.targetQty, batch.unit)}`.trim();
      const batchPara = body.insertParagraph(idx++, batchHeader);
      batchPara.setHeading(DocumentApp.ParagraphHeading.HEADING1);

      const batchBaseQty = `${fmtQty_(batch.targetQty)}${batch.unit || ""}`;
      appendTextWithBoldUnderline_(batchPara, batchHeader, batchBaseQty);

      const requiredSubTasks = getSubRecipeRequirements(batch);

      requiredSubTasks.forEach((subTask) => {
        const subId = subTask.itemId;

        if (printedSub.has(subId)) {
          const seeAboveText = `See above: ${subTask.itemName} ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
          const li = body.insertListItem(idx++, seeAboveText);
          li.setGlyphType(DocumentApp.GlyphType.BULLET);

          const seeAboveBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
          appendTextWithBoldUnderline_(li, seeAboveText, seeAboveBaseQty);
          return;
        }

        printedSub.add(subId);

        const subHeader = `${subTask.itemName} ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
        const subPara = body.insertParagraph(idx++, subHeader);
        subPara.setHeading(DocumentApp.ParagraphHeading.HEADING2);

        const subBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
        appendTextWithBoldUnderline_(subPara, subHeader, subBaseQty);

        // Add scaler link for sub-recipe if configured
        const subScalerLink = getScalerLink_(subTask.recipeId);
        if (subScalerLink) {
          const scalerPara = body.insertParagraph(idx++, "");
          scalerPara.appendText("📐 ").setFontSize(10);
          scalerPara.appendText("Scale this recipe").setLinkUrl(subScalerLink).setFontSize(10).setForegroundColor("#007AFF");
        }

        if (!subTask.recipeId) {
          const li = body.insertListItem(idx++, "No recipe linked.");
          li.setGlyphType(DocumentApp.GlyphType.BULLET);
          return;
        }

        const subLines = linesByRecipeId[subTask.recipeId] || [];
        if (!subLines.length) {
          const li = body.insertListItem(idx++, "No recipe lines found.");
          li.setGlyphType(DocumentApp.GlyphType.BULLET);
        } else {
          subLines.forEach((ln) => {
            const comp = itemsById[ln.itemId];
            const compName = comp ? (comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)") : "(Unknown Item)";
            const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

            const total = ln.qtyPerBatch * (subTask.batchesNeeded || 0);
            if (!Number.isFinite(total) || total === 0) return;

            const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
            const li = body.insertListItem(idx++, bulletText);
            li.setGlyphType(DocumentApp.GlyphType.BULLET);

            const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
            appendTextWithBoldUnderline_(li, bulletText, bulletBaseQty);
          });
        }

        if ((subTask.method || "").trim()) {
          body.insertParagraph(idx++, "");
          body.insertParagraph(idx++, "Method:").setHeading(DocumentApp.ParagraphHeading.HEADING3);
          const methodLines = String(subTask.method || "").split(/\r?\n/);
          methodLines.forEach((ln) => {
            const txt = ln.trim();
            if (txt) body.insertParagraph(idx++, txt);
          });
        }

        if ((subTask.notes || "").trim()) {
          body.insertParagraph(idx++, "Notes:").editAsText().setBold(true);
          const noteLines = String(subTask.notes || "").split(/\r?\n/);
          noteLines.forEach((ln) => {
            const txt = ln.trim();
            if (txt) body.insertParagraph(idx++, txt);
          });
        }
      });
    });
  }

  cleanupMarkers_(body);
  doc.saveAndClose();
  return doc.getId();
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
    postToSlack_(getSlackWebhook_(prop), text);
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
 * @param {string} docType - Document type (e.g., "Batching List", "Gooch Ordering")
 * @param {string} staffRole - Staff role (e.g., "Prep Team", "Ordering - Gooch")
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
  para.appendText("Have feedback? ").setFontSize(10).setForegroundColor("#666666");
  para.appendText("Submit here").setLinkUrl(feedbackLink).setFontSize(10).setForegroundColor("#007AFF").setUnderline(true);
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
  para.appendText("Have feedback? ").setFontSize(10).setForegroundColor("#666666");
  para.appendText("Submit here").setLinkUrl(feedbackLink).setFontSize(10).setForegroundColor("#007AFF").setUnderline(true);
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
  body.clear();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  const reminderBatching = body.appendParagraph("Add email contacts to supplier sheet, located here: https://airtable.com/appNsFRhuU47e9qlR/shrRpMHW3iFHsCkgY");
  reminderBatching.editAsText().setBold(true).setUnderline(true);

  // Add feedback link
  appendFeedbackLink_(body, runId, title, staffRole);

  // Pre-filter batches that have visible content (at least one ingredient with non-zero qty)
  const visibleBatchTasks = batchTasks.filter((t) => {
    if (!t.recipeId) return false;
    const lines = linesByRecipeId[t.recipeId] || [];
    if (!lines.length) return false;
    return lines.some((ln) => {
      const total = ln.qtyPerBatch * (t.batchesNeeded || 0);
      return Number.isFinite(total) && total > 0;
    });
  });

  if (!visibleBatchTasks.length) {
    body.appendParagraph("No Batch tasks with ingredients found.");
    doc.saveAndClose();
    return id;
  }

  visibleBatchTasks.forEach((t) => {
    const batchHeader = `${t.itemName} ${formatQtyWithBuffer_(t.targetQty, t.unit)}`.trim();
    const batchPara = body.appendParagraph(batchHeader).setHeading(DocumentApp.ParagraphHeading.HEADING1);

    const baseQtyText = `${fmtQty_(t.targetQty)}${t.unit || ""}`;
    appendTextWithBoldUnderline_(batchPara, batchHeader, baseQtyText);

    // Add scaler link if configured
    const scalerLink = getScalerLink_(t.recipeId);
    if (scalerLink) {
      const scalerPara = body.appendParagraph("");
      scalerPara.appendText("📐 ").setFontSize(10);
      scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink).setFontSize(10).setForegroundColor("#007AFF");
    }

    const lines = linesByRecipeId[t.recipeId] || [];
    lines.forEach((ln) => {
      const comp = itemsById[ln.itemId];
      const compName = comp ? (comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)") : "(Unknown Item)";
      const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

      const total = ln.qtyPerBatch * (t.batchesNeeded || 0);
      if (!Number.isFinite(total) || total === 0) return;

      const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
      const bulletPara = appendBullet_(body, bulletText);

      const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
      appendTextWithBoldUnderline_(bulletPara, bulletText, bulletBaseQty);
    });

    if ((t.method || "").trim()) {
      body.appendParagraph("");
      body.appendParagraph("Method:").setHeading(DocumentApp.ParagraphHeading.HEADING3);
      appendMultiline_(body, t.method);
    }

    if ((t.notes || "").trim()) {
      body.appendParagraph("Notes:").editAsText().setBold(true);
      appendMultiline_(body, t.notes);
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
  body.clear();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  const reminderIngredient = body.appendParagraph("Add email contacts to supplier sheet, located here: https://airtable.com/appNsFRhuU47e9qlR/shrRpMHW3iFHsCkgY");
  reminderIngredient.editAsText().setBold(true).setUnderline(true);

  // Add feedback link
  appendFeedbackLink_(body, runId, title, staffRole);

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

  if (!batchesWithSubRecipes.length) {
    body.appendParagraph("No batches with sub-recipe prep requirements found.");
    doc.saveAndClose();
    return id;
  }

  const printedSub = new Set();

  batchesWithSubRecipes.forEach((batch) => {
    const batchHeader = `${batch.itemName} ${formatQtyWithBuffer_(batch.targetQty, batch.unit)}`.trim();
    const batchPara = body.appendParagraph(batchHeader).setHeading(DocumentApp.ParagraphHeading.HEADING1);

    const batchBaseQty = `${fmtQty_(batch.targetQty)}${batch.unit || ""}`;
    appendTextWithBoldUnderline_(batchPara, batchHeader, batchBaseQty);

    const requiredSubTasks = getSubRecipeReqs(batch);

    requiredSubTasks.forEach((subTask) => {
      const subId = subTask.itemId;

      if (printedSub.has(subId)) {
        const seeAboveText = `See above: ${subTask.itemName} ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
        const seeAbovePara = appendBullet_(body, seeAboveText);
        
        const seeAboveBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
        appendTextWithBoldUnderline_(seeAbovePara, seeAboveText, seeAboveBaseQty);
        return;
      }

      printedSub.add(subId);

      const subHeader = `${subTask.itemName} ${formatQtyWithBuffer_(subTask.targetQty, subTask.unit)}`.trim();
      const subPara = body.appendParagraph(subHeader).setHeading(DocumentApp.ParagraphHeading.HEADING2);

      const subBaseQty = `${fmtQty_(subTask.targetQty)}${subTask.unit || ""}`;
      appendTextWithBoldUnderline_(subPara, subHeader, subBaseQty);

      // Add scaler link for sub-recipe if configured
      const subScalerLink = getScalerLink_(subTask.recipeId);
      if (subScalerLink) {
        const scalerPara = body.appendParagraph("");
        scalerPara.appendText("📐 ").setFontSize(10);
        scalerPara.appendText("Scale this recipe").setLinkUrl(subScalerLink).setFontSize(10).setForegroundColor("#007AFF");
      }

      if (!subTask.recipeId) {
        appendBullet_(body, "No recipe linked.");
        return;
      }

      const subLines = linesByRecipeId[subTask.recipeId] || [];
      if (!subLines.length) {
        appendBullet_(body, "No recipe lines found.");
      } else {
        subLines.forEach((ln) => {
          const comp = itemsById[ln.itemId];
          const compName = comp ? (comp.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)") : "(Unknown Item)";
          const compUnit = comp ? cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) : "";

          const total = ln.qtyPerBatch * (subTask.batchesNeeded || 0);
          if (!Number.isFinite(total) || total === 0) return;

          const bulletText = `${compName} ${formatQtyWithBuffer_(total, compUnit)}`.trim();
          const bulletPara = appendBullet_(body, bulletText);

          const bulletBaseQty = `${fmtQty_(total)}${compUnit || ""}`;
          appendTextWithBoldUnderline_(bulletPara, bulletText, bulletBaseQty);
        });
      }

      if ((subTask.method || "").trim()) {
        body.appendParagraph("");
        body.appendParagraph("Method:").setHeading(DocumentApp.ParagraphHeading.HEADING3);
        appendMultiline_(body, subTask.method);
      }

      if ((subTask.notes || "").trim()) {
        body.appendParagraph("Notes:").editAsText().setBold(true);
        appendMultiline_(body, subTask.notes);
      }
    });
  });

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
 * NEGLIGIBLE STOCK DECREMENTS SECTION
 * ======================================================= */

/**
 * Renders the "Negligible Stock Decrements" section.
 *
 * Works in two modes:
 *   - Append mode  (startIdx === -1): uses body.appendParagraph / body.appendListItem
 *   - Insert mode  (startIdx >= 0):  uses body.insertParagraph(idx) for template path,
 *                                    inserting content before any footer elements
 *
 * @param {Body}   body               - The document body
 * @param {Array}  negligibleSuppliers - Supplier blocks from buildOrdering_ (may be empty)
 * @param {number} startIdx            - Insertion index, or -1 for append mode
 * @returns {number} Next insertion index (only meaningful in insert mode)
 */
function renderNegligibleSection_(body, negligibleSuppliers, startIdx) {
  if (!negligibleSuppliers || !negligibleSuppliers.length) return startIdx;

  const useAppend = startIdx === -1;
  let idx = startIdx;

  function p(text) {
    if (useAppend) return body.appendParagraph(text || "");
    return body.insertParagraph(idx++, text || "");
  }

  function li(text) {
    if (useAppend) {
      const item = body.appendListItem(String(text || ""));
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      return item;
    }
    const item = body.insertListItem(idx++, String(text || ""));
    item.setGlyphType(DocumentApp.GlyphType.BULLET);
    return item;
  }

  p("");
  p("NEGLIGIBLE STOCK DECREMENTS").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  p("Likely have stock on hand. VERIFY BEFORE ORDERING").editAsText().setItalic(true);

  negligibleSuppliers.forEach((s) => {
    p(s.supplierName).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    (s.lines || []).forEach((l) => {
      const pct = (l.ratio * 100).toFixed(1);
      const unitStr = l.unit || "";
      li(`${l.itemName}   ${fmtQty_(l.qty)}${unitStr} needed / ${fmtQty_(l.orderSize)}${unitStr} unit = ${pct}%`);
    });
  });

  return idx;
}

/* =========================================================
 * ORDERING FALLBACK
 * ======================================================= */

function buildOrdering_(reqs, itemsById, suppliersById) {
  const goochMap = new Map();
  const sabsMap = new Map();
  const needsRouting = [];

  reqs.forEach((r) => {
    const itemId = firstId_(r.fields[CFG.airtable.fields.reqItem]);
    const item = itemId ? itemsById[itemId] : null;
    const itemName = item ? (item.fields[CFG.airtable.fields.itemName] || "(Unnamed Item)") : "(Unknown Item)";
    const unit = item ? cellToText_(item.fields[CFG.airtable.fields.itemUnit]) : "";
    const qty = num_(r.fields[CFG.airtable.fields.reqQty]);
    if (!Number.isFinite(qty) || qty === 0) return;

    // Skip Batch and Sub Recipe items - these are made in-house, not ordered
    const itemType = item ? normaliseItemType_(cellToText_(item.fields[CFG.airtable.fields.itemType])) : "";
    if (itemType === CFG.airtable.itemTypes.batch || CFG.airtable.itemTypes.subRecipeVariants.has(itemType)) {
      return;
    }

    const supplierId = firstId_(r.fields[CFG.airtable.fields.reqSupplierLink]);
    const supplierRec = supplierId ? suppliersById[supplierId] : null;
    const supplierName = firstNonEmpty_([
      r.fields[CFG.airtable.fields.reqSupplierNameStatic],
      supplierRec ? supplierRec.fields[CFG.airtable.fields.supplierName] : ""
    ]) || "UNASSIGNED SUPPLIER";

    const staffText = firstNonEmpty_([
      r.fields[CFG.airtable.fields.reqStaffStatic],
      supplierRec ? supplierRec.fields[CFG.airtable.fields.supplierOrderingStaff] : "",
      cellToText_(r.fields[CFG.airtable.fields.reqOrderingStaff]),
    ]) || "";

    const staffKey = matchStaff_(String(staffText));

    const supplierLower = supplierName.toLowerCase();
    const staffLower = staffText.toLowerCase();

    if (supplierLower.includes("in house") || staffLower.includes("in house")) {
      return;
    }

    if (supplierLower.includes("unassigned") || !staffKey) {
      needsRouting.push({ supplierName, itemName, unit, qty });
      return;
    }

    // Order size from lookup field (null/0 means we can't calculate ratio → treat as normal)
    const orderSize = num_(r.fields[CFG.airtable.fields.reqOrderSize]);

    const key = `${supplierName}|||${itemName}|||${unit}`;
    const map = staffKey === "gooch" ? goochMap : sabsMap;
    if (map.has(key)) {
      map.get(key).qty += qty;
    } else {
      map.set(key, { supplierName, itemName, unit, qty, orderSize });
    }
  });

  // Split each aggregated map into normal and negligible based on ratio threshold.
  // Ratio is calculated on the final aggregated qty so merging doesn't change classification.
  function splitByRatio_(map) {
    const normal = new Map();
    const negligible = new Map();
    map.forEach((row, key) => {
      const ratio = row.orderSize > 0 ? row.qty / row.orderSize : Infinity;
      row.ratio = ratio;
      if (ratio <= CFG.negligibleRatioThreshold) {
        negligible.set(key, row);
      } else {
        normal.set(key, row);
      }
    });
    return { normal, negligible };
  }

  const { normal: goochNormal, negligible: goochNegligible } = splitByRatio_(goochMap);
  const { normal: sabsNormal, negligible: sabsNegligible } = splitByRatio_(sabsMap);

  return {
    gooch: {
      ...toSupplierBlocks_(goochNormal, needsRouting, suppliersById),
      negligible: toSupplierBlocks_(goochNegligible, [], suppliersById).suppliers,
    },
    sabs: {
      ...toSupplierBlocks_(sabsNormal, needsRouting, suppliersById),
      negligible: toSupplierBlocks_(sabsNegligible, [], suppliersById).suppliers,
    },
  };
}

function toSupplierBlocks_(map, needsRouting, suppliersById) {
  const rows = Array.from(map.values());

  const bySupplier = new Map();
  rows.forEach((r) => {
    if (!bySupplier.has(r.supplierName)) bySupplier.set(r.supplierName, []);
    bySupplier.get(r.supplierName).push(r);
  });

  const suppliers = Array.from(bySupplier.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([supplierName, lines]) => {
      lines.sort((x, y) => x.itemName.localeCompare(y.itemName));

      let supplierEmail = "";
      if (suppliersById) {
        const supplierRec = Object.values(suppliersById).find(
          s => s.fields[CFG.airtable.fields.supplierName] === supplierName
        );
        if (supplierRec) {
          supplierEmail = cellToText_(supplierRec.fields[CFG.airtable.fields.supplierEmail]) || "";
        }
      }

      return { supplierName, supplierEmail, lines };
    });

  const routing = (needsRouting || [])
    .slice()
    .sort((a, b) => (a.supplierName + a.itemName).localeCompare(b.supplierName + b.itemName));

  return { suppliers, needsRouting: routing };
}

function createOrReplaceOrderingDoc_(folder, title, dateFormatted, owner, data, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = DocumentApp.create(title);
  const id = doc.getId();
  moveToFolder_(id, folder);
  doc.setName(title);

  const body = doc.getBody();
  body.clear();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  const reminderOrdering = body.appendParagraph("Add email contacts to supplier sheet, located here: https://airtable.com/appNsFRhuU47e9qlR/shrRpMHW3iFHsCkgY");
  reminderOrdering.editAsText().setBold(true).setUnderline(true);

  // Add feedback link
  appendFeedbackLink_(body, runId, title, staffRole);

  const suppliers = data?.suppliers || [];
  const needsRouting = data?.needsRouting || [];

  if (!suppliers.length && !needsRouting.length) {
    body.appendParagraph("No ordering lines found.");
    doc.saveAndClose();
    return id;
  }

  suppliers.forEach((s) => {
    body.appendParagraph(s.supplierName).setHeading(DocumentApp.ParagraphHeading.HEADING1);

    if (s.supplierEmail && s.supplierEmail.trim()) {
      body.appendParagraph(s.supplierEmail.trim());
    } else {
      body.appendParagraph("Portal or Other");
    }

    (s.lines || []).forEach((l) => {
      const bulletText = `${l.itemName} ${formatQtyWithBuffer_(l.qty, l.unit)}`.trim();
      const bulletPara = appendBullet_(body, bulletText);

      const baseQty = `${fmtQty_(l.qty)}${l.unit || ""}`;
      appendTextWithBoldUnderline_(bulletPara, bulletText, baseQty);
    });
  });

  // Add unassigned/needs routing items at the END
  if (needsRouting.length) {
    body.appendParagraph(""); // Blank line
    body.appendParagraph("⚠️ NEEDS ASSIGNMENT").setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph("These items need supplier/staff assignment in Airtable:");

    needsRouting.forEach((r) => {
      const bulletText = `${r.supplierName}: ${r.itemName} ${formatQtyWithBuffer_(r.qty, r.unit)}`.trim();
      appendBullet_(body, bulletText);
    });
  }

  // Add negligible stock decrements section at the END
  renderNegligibleSection_(body, data?.negligible || [], -1);

  doc.saveAndClose();
  return id;
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
  if (!v.startsWith("app")) throw new Error(`AIRTABLE_BASE_ID looks wrong: ${v}`);
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

function matchStaff_(staffText) {
  const s = (staffText || "").toLowerCase();
  if (!s) return null;

  if (CFG.airtable.staffAliases.gooch.some((x) => s.includes(x))) return "gooch";
  if (CFG.airtable.staffAliases.sabs.some((x) => s.includes(x))) return "sabs";
  return null;
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

function formatNow_() {
  return Utilities.formatDate(new Date(), CFG.timezone, "yyyy-MM-dd HH:mm");
}

function formatRunDateShort_(run) {
  const prepWeek = run.fields[CFG.airtable.fields.runPrepWeek];
  const dt = prepWeek ? new Date(prepWeek) : new Date(run.createdTime);
  return Utilities.formatDate(dt, CFG.timezone, "dd/MM/yyyy");
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
