/****************************************************
 * SAKURA HOUSE PREP SYSTEM — DOCUMENT GENERATORS
 * Part of the GoogleDocsPrepSystem split (PrepDocGenerators.gs)
 * Ordering, Batching, and Ingredient Prep doc creation
 ****************************************************/

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
 * ORDERING DATA BUILDER
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

    // Order size from lookup field (null/0 means we can't calculate ratio -> treat as normal)
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
 * PROGRAMMATIC FALLBACK DOCS
 * ======================================================= */

function createOrReplaceOrderingDoc_(folder, title, dateFormatted, owner, data, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = DocumentApp.create(title);
  const id = doc.getId();
  moveToFolder_(id, folder);
  doc.setName(title);

  const body = doc.getBody();
  body.clearContent();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  const reminderOrdering = body.appendParagraph("Add email contacts to supplier sheet, located here: " + (getOptionalProp_(CFG.props.supplierSheetUrl) || "https://airtable.com"));
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

function createOrReplaceBatchingDoc_(folder, title, dateFormatted, batchTasks, linesByRecipeId, itemsById, runId, staffRole) {
  trashExistingByName_(folder, title);

  const doc = DocumentApp.create(title);
  const id = doc.getId();
  moveToFolder_(id, folder);
  doc.setName(title);

  const body = doc.getBody();
  body.clearContent();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  const reminderBatching = body.appendParagraph("Add email contacts to supplier sheet, located here: " + (getOptionalProp_(CFG.props.supplierSheetUrl) || "https://airtable.com"));
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
  body.clearContent();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(dateFormatted).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  const reminderIngredient = body.appendParagraph("Add email contacts to supplier sheet, located here: " + (getOptionalProp_(CFG.props.supplierSheetUrl) || "https://airtable.com"));
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
