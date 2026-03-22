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

  // Insert feedback link at the top of content
  insertIndex = insertFeedbackLink_(body, insertIndex, runId, title, staffRole);

  // Additional Tasks section (blank lines for handwritten tasks)
  insertIndex = insertAdditionalTasks_(body, insertIndex);

  // Pre-filter batches to only those with sub-recipe requirements
  const batchesWithSubRecipes = batchTasks.filter((batch) => {
    return getSubRecipeRequirements_(batch, linesByRecipeId, itemsById, subTasksByItemId).length > 0;
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

      const requiredSubTasks = getSubRecipeRequirements_(batch, linesByRecipeId, itemsById, subTasksByItemId);

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
