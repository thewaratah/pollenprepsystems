/****************************************************
 * PREP SYSTEM — DOCUMENT GENERATORS
 * Part of the GoogleDocsPrepSystem split (PrepDocGenerators.gs)
 * All document creation: Batching, Ingredient Prep, Combined Ordering
 ****************************************************/

/* =========================================================
 * SHARED HELPER: SUB-RECIPE REQUIREMENTS
 *
 * Extracted from createIngredientPrepDocFromTemplate_ for reuse.
 * ======================================================= */

/**
 * Get sub-recipe task objects required by a batch's recipe.
 * Walks the batch recipe lines, finds items with sub-recipe type,
 * and returns the matching sub-tasks.
 *
 * @param {Object} batch - Batch task object with recipeId
 * @param {Object} linesByRecipeId - Map of recipeId → [{itemId, qtyPerBatch}]
 * @param {Object} itemsById - Map of itemId → Airtable item record
 * @param {Object} subTasksByItemId - Map of itemId → sub-recipe task object
 * @returns {Object[]} Array of sub-recipe task objects required by this batch
 */
function getSubRecipeRequirements_(batch, linesByRecipeId, itemsById, subTasksByItemId) {
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

/* =========================================================
 * BATCHING DOC (TEMPLATE-FIRST)
 * ======================================================= */

function createBatchingDoc_(folder, title, dateFormatted, runLabel, batchTasks, linesByRecipeId, itemsById, runId) {
  const templateId = getOptionalProp_(CFG.props.templateBatching);
  const staffRole = "Prep Team";

  if (!templateId || !templateExists_(templateId)) {
    throw new Error("Batching template not found — check WARATAH_TEMPLATE_BATCHING_ID Script Property.");
  }

  return createBatchingDocFromTemplate_(folder, title, dateFormatted, runLabel, batchTasks, linesByRecipeId, itemsById, templateId, runId, staffRole);
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
  let insertIndex = findContentInsertIndex_(body);

  // Remove any pre-existing placeholder content from template
  removeElementsContainingText_(body, "No Batch tasks");
  removeElementsContainingText_(body, "No recipe linked");
  removeElementsContainingText_(body, "No recipe lines");

  // Summary info table
  const visibleBatchTasks = batchTasks.filter((t) => {
    if (!t.recipeId) return false;
    return (linesByRecipeId[t.recipeId] || []).length > 0;
  });

  insertIndex = insertSummaryInfo_(body, insertIndex, [
    ["Document", "Batching Run Sheet"],
    ["Date", dateFormatted],
    ["Prep Run", runLabel],
    ["Total Batches", String(visibleBatchTasks.length)],
  ]);

  // Insert feedback link
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

  // Additional Tasks section (checkboxes for handwritten tasks)
  insertIndex = insertAdditionalTasks_(body, insertIndex);

  if (!visibleBatchTasks.length) {
    body.insertParagraph(insertIndex, "No Batch tasks with ingredients found.");
  } else {
    let idx = insertIndex;

    visibleBatchTasks.forEach((t, i) => {
      idx = insertItemBlock_(body, idx, t, linesByRecipeId, itemsById, {
        headingLevel: DocumentApp.ParagraphHeading.HEADING1,
        showScaler: true,
        pageBreak: i > 0,
      });
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

  if (!templateId || !templateExists_(templateId)) {
    throw new Error("Ingredient Prep template not found — check WARATAH_TEMPLATE_INGREDIENT_PREP_ID Script Property.");
  }

  return createIngredientPrepDocFromTemplate_(folder, title, dateFormatted, runLabel, batchTasks, subTasksByItemId, linesByRecipeId, itemsById, templateId, runId, staffRole);
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
  let insertIndex = findContentInsertIndex_(body);

  // Remove any pre-existing placeholder content from template
  removeElementsContainingText_(body, "No Batch tasks");
  removeElementsContainingText_(body, "No sub-recipe prep");
  removeElementsContainingText_(body, "No batches with");
  removeElementsContainingText_(body, "No prep tasks");
  removeElementsContainingText_(body, "No recipe linked");

  // Pre-filter batches
  const batchesWithSubRecipes = batchTasks.filter((batch) => {
    return getSubRecipeRequirements_(batch, linesByRecipeId, itemsById, subTasksByItemId).length > 0;
  });
  const tasksToRender = batchesWithSubRecipes.length ? null : batchTasks;
  const totalItems = tasksToRender !== null ? (tasksToRender.length) :
    (batchesWithSubRecipes.length + batchTasks.filter((t) => CFG.airtable.itemTypes.ingredientPrepOnly.has(t.itemType)).length);

  // Summary info table
  insertIndex = insertSummaryInfo_(body, insertIndex, [
    ["Document", "Ingredient Prep Run Sheet"],
    ["Date", dateFormatted],
    ["Prep Run", runLabel],
    ["Total Items", String(totalItems)],
  ]);

  // Insert feedback link
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

  // Additional Tasks section (checkboxes)
  insertIndex = insertAdditionalTasks_(body, insertIndex);

  // FLAT MODEL (e.g. Waratah): tasks are top-level prep items, no nested sub-recipes
  if (tasksToRender !== null) {
    if (!tasksToRender.length) {
      body.insertParagraph(insertIndex, "No prep tasks found.");
    } else {
      let idx = insertIndex;
      tasksToRender.forEach((task, i) => {
        idx = insertItemBlock_(body, idx, task, linesByRecipeId, itemsById, {
          headingLevel: DocumentApp.ParagraphHeading.HEADING1,
          showScaler: true,
          pageBreak: i > 0,
        });
      });
    }
  } else {
    // NESTED MODEL: sub-recipes grouped under parent batches
    let idx = insertIndex;
    const s = CFG.docStyle;
    const printedSub = new Set();

    batchesWithSubRecipes.forEach((batch, batchIdx) => {
      if (batchIdx > 0) {
        body.insertHorizontalRule(idx++);
        body.insertPageBreak(idx++);
      }

      // Parent batch heading with brand color
      const batchPara = body.insertParagraph(idx++, batch.itemName);
      batchPara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
      batchPara.editAsText().setForegroundColor(s.colors.primary);
      const batchToMakeText = ("To Make: " + formatQtyWithBuffer_(batch.targetQty, batch.unit)).trim();
      const batchToMakePara = body.insertParagraph(idx++, batchToMakeText);
      batchToMakePara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(s.font);
      batchToMakePara.editAsText().setForegroundColor(s.colors.primaryDark);
      appendTextWithBoldUnderline_(batchToMakePara, batchToMakeText, fmtQty_(batch.targetQty) + (batch.unit || ""));

      idx = insertParStockLines_(body, idx, batch);

      const requiredSubTasks = getSubRecipeRequirements_(batch, linesByRecipeId, itemsById, subTasksByItemId);

      requiredSubTasks.forEach((subTask) => {
        const subId = subTask.itemId;

        if (printedSub.has(subId)) {
          const seeAboveText = ("See above: " + subTask.itemName + " " + formatQtyWithBuffer_(subTask.targetQty, subTask.unit)).trim();
          const li = body.insertListItem(idx++, seeAboveText);
          li.setGlyphType(DocumentApp.GlyphType.BULLET).setFontFamily(s.font);
          appendTextWithBoldUnderline_(li, seeAboveText, fmtQty_(subTask.targetQty) + (subTask.unit || ""));
          return;
        }

        printedSub.add(subId);

        // Render sub-recipe via insertItemBlock_ at HEADING2 level
        idx = insertItemBlock_(body, idx, subTask, linesByRecipeId, itemsById, {
          headingLevel: DocumentApp.ParagraphHeading.HEADING2,
          showScaler: true,
          pageBreak: false,
        });
      });
    });

    // Garnish & Other section
    const garnishOtherTasks = batchTasks.filter(
      (t) => CFG.airtable.itemTypes.ingredientPrepOnly.has(t.itemType)
    );
    if (garnishOtherTasks.length) {
      body.insertHorizontalRule(idx++);
      body.insertPageBreak(idx++);

      const garnishHeadPara = body.insertParagraph(idx++, "Garnish & Other");
      garnishHeadPara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
      garnishHeadPara.editAsText().setForegroundColor(s.colors.primary);

      garnishOtherTasks.forEach((task) => {
        idx = insertItemBlock_(body, idx, task, linesByRecipeId, itemsById, {
          headingLevel: DocumentApp.ParagraphHeading.HEADING2,
          showScaler: true,
          pageBreak: false,
        });
      });
    }
  }

  cleanupMarkers_(body);
  doc.saveAndClose();
  return doc.getId();
}

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
    // Remove {{CONTENT}} marker using shared helper
    findContentInsertIndex_(doc.getBody());
  } else {
    trashExistingByName_(orderFolder, docTitle);
    doc = DocumentApp.create(docTitle);
    moveToFolder_(doc.getId(), orderFolder);
    doc.setName(docTitle);
  }

  const body = doc.getBody();
  const s = CFG.docStyle;

  if (!templateId || !templateExists_(templateId)) {
    body.clearContent();
    var titlePara = body.appendParagraph(docTitle);
    titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
    titlePara.editAsText().setForegroundColor(s.colors.primary);
  }

  // Summary info table (append mode — build as array, use appendTable)
  var summaryPairs = [
    ["Document", "Ordering Run Sheet"],
    ["Session", sessionName],
    ["Counted By", countedBy],
    ["Suppliers", String(supplierMap.size)],
    ["Stock Items", String(orders.length)],
    ["Prep Items", String(prepOnlyRows.length)],
  ];
  var summaryTable = body.appendTable(summaryPairs);
  summaryTable.setBorderColor(s.table.borderColor);
  summaryTable.setBorderWidth(0.5);
  s.table.summaryWidths.forEach(function(w, i) { summaryTable.setColumnWidth(i, w); });
  for (var ri = 0; ri < summaryTable.getNumRows(); ri++) {
    var srow = summaryTable.getRow(ri);
    srow.getCell(0).setBackgroundColor("#F9F9F9").setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(8).setPaddingRight(4);
    srow.getCell(0).editAsText().setFontFamily(s.font).setFontSize(9).setBold(true).setForegroundColor(s.colors.mutedText);
    srow.getCell(1).setBackgroundColor("#FFFFFF").setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(8).setPaddingRight(4);
    srow.getCell(1).editAsText().setFontFamily(s.font).setFontSize(9).setForegroundColor(s.colors.bodyText);
  }

  // Feedback link
  appendFeedbackLink_(body, null, docTitle, "Ordering");
  body.appendParagraph("").setFontFamily(s.font);

  // Helper: build ordering table rows from data
  function buildOrderRows_(dataRows, qtyField) {
    var tableRows = [];
    dataRows.forEach(function(r) {
      var qty = r[qtyField || "combinedQty"] || r.qty || 0;
      var displayUnit = (r.unit && r.unit !== "ml") ? r.unit : "Bottles";
      tableRows.push([r.itemName, fmtQty_(qty) + "x", displayUnit, "\u2610"]);
    });
    return tableRows;
  }

  var orderColWidths = [s.table.colWidths.item, s.table.colWidths.qty, s.table.colWidths.unit, s.table.colWidths.check];

  // ── 8. Supplier-grouped bar stock orders ──
  var sortedSuppliers = Array.from(supplierMap.entries())
    .sort(function(a, b) { return a[0].localeCompare(b[0]); });

  sortedSuppliers.forEach(function(entry) {
    var supplierName = entry[0], rows = entry[1];
    rows.sort(function(a, b) { return a.itemName.localeCompare(b.itemName); });

    var heading = body.appendParagraph(supplierName);
    heading.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
    heading.editAsText().setForegroundColor(s.colors.primary);

    appendDataTable_(body, ["Item", "Qty", "Unit", "\u2610"], buildOrderRows_(rows, "combinedQty"), orderColWidths);
  });

  // ── 9. Items below par — no supplier ──
  if (noSupplierRows.length) {
    noSupplierRows.sort(function(a, b) { return a.itemName.localeCompare(b.itemName); });
    body.appendParagraph("");
    var noSupHead = body.appendParagraph("ITEMS BELOW PAR \u2014 NO SUPPLIER");
    noSupHead.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
    noSupHead.editAsText().setForegroundColor(s.colors.primary);

    appendDataTable_(body, ["Item", "Qty", "Unit", "\u2610"], buildOrderRows_(noSupplierRows, "combinedQty"), orderColWidths);
  }

  // ── 9b/9c. Staff-specific prep orders ──
  function renderStaffPrepSection_(body, sectionTitle, subtitle, groups) {
    body.appendParagraph("");
    var sHead = body.appendParagraph(sectionTitle);
    sHead.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
    sHead.editAsText().setForegroundColor(s.colors.primary);
    body.appendParagraph(subtitle).setFontFamily(s.font);

    var sortedSups = Array.from(groups.grouped.entries())
      .sort(function(a, b) { return a[0].localeCompare(b[0]); });

    sortedSups.forEach(function(entry) {
      var supName = entry[0], rows = entry[1];
      rows.sort(function(a, b) { return a.itemName.localeCompare(b.itemName); });
      var subHead = body.appendParagraph(supName);
      subHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(s.font);
      subHead.editAsText().setForegroundColor(s.colors.primaryDark);

      appendDataTable_(body, ["Item", "Qty", "Unit", "\u2610"], buildOrderRows_(rows, "qty"), orderColWidths);
    });

    if (groups.noSupplier.length) {
      groups.noSupplier.sort(function(a, b) { return a.itemName.localeCompare(b.itemName); });
      var nsHead = body.appendParagraph("NO SUPPLIER");
      nsHead.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(s.font);
      nsHead.editAsText().setForegroundColor(s.colors.primaryDark);

      appendDataTable_(body, ["Item", "Qty", "Unit", "\u2610"], buildOrderRows_(groups.noSupplier, "qty"), orderColWidths);
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

  // ── 10. Prep-only items ──
  if (otherPrepRows.length) {
    otherPrepRows.sort(function(a, b) { return a.itemName.localeCompare(b.itemName); });
    body.appendParagraph("");
    var poHead = body.appendParagraph("PREP-ONLY ITEMS (no bar stock count)");
    poHead.setHeading(DocumentApp.ParagraphHeading.HEADING1).setFontFamily(s.font);
    poHead.editAsText().setForegroundColor(s.colors.primary);
    body.appendParagraph("These items are needed for prep but are not tracked in bar stock.").setFontFamily(s.font);

    var prepTableRows = [];
    otherPrepRows.forEach(function(r) {
      var displayUnit = (r.unit && r.unit !== "ml") ? r.unit : "Bottles";
      var supplierNote = r.supplier ? " (" + r.supplier + ")" : "";
      prepTableRows.push([r.itemName + supplierNote, fmtQty_(r.qty) + "x", displayUnit, "\u2610"]);
    });
    appendDataTable_(body, ["Item", "Qty", "Unit", "\u2610"], prepTableRows, orderColWidths);
  }

  // ── 11. Empty state ──
  if (!supplierMap.size && !noSupplierRows.length && !andieRows.length && !bladeRows.length && !otherPrepRows.length) {
    body.appendParagraph("No ordering lines found.").setFontFamily(s.font);
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
