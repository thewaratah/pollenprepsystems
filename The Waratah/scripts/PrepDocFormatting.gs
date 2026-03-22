/****************************************************
 * PREP SYSTEM — DOCUMENT FORMATTING
 * Part of the GoogleDocsPrepSystem split (PrepDocFormatting.gs)
 * Template engine + formatting helpers
 ****************************************************/

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
 * CONTENT INSERT INDEX HELPER
 *
 * Extracted from 3 identical blocks in the template paths
 * (ordering, batching, ingredient prep). Finds the {{CONTENT}}
 * marker, removes it, and returns the insertion index.
 * ======================================================= */

/**
 * Find the {{CONTENT}} marker in a document body, remove it,
 * and return the index where dynamic content should be inserted.
 *
 * @param {Body} body - The document body
 * @returns {number} The index at which to start inserting content
 */
function findContentInsertIndex_(body) {
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

  return insertIndex;
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
  text.setFontFamily(CFG.docStyle.font);
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

  var s = CFG.docStyle;
  const para = body.insertParagraph(insertIndex, "");
  para.setFontFamily(s.font);
  para.appendText("Have feedback? ").setFontSize(10).setForegroundColor(s.colors.mutedText).setFontFamily(s.font);
  para.appendText("Submit here").setLinkUrl(feedbackLink).setFontSize(10).setForegroundColor(s.colors.linkColor).setUnderline(true).setFontFamily(s.font);
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

  var s = CFG.docStyle;
  body.appendParagraph(""); // Spacer
  const para = body.appendParagraph("");
  para.setFontFamily(s.font);
  para.appendText("Have feedback? ").setFontSize(10).setForegroundColor(s.colors.mutedText).setFontFamily(s.font);
  para.appendText("Submit here").setLinkUrl(feedbackLink).setFontSize(10).setForegroundColor(s.colors.linkColor).setUnderline(true).setFontFamily(s.font);
}

/**
 * Append an "Additional Tasks" section (HEADING2 + 7 checkbox lines) using appendParagraph.
 * Used in programmatic/append path for Batching and Ingredient Prep docs.
 */
function appendAdditionalTasks_(body) {
  var s = CFG.docStyle;
  var heading = body.appendParagraph("Additional Tasks");
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(s.font);
  heading.editAsText().setForegroundColor(s.colors.primaryDark);
  for (var i = 0; i < 7; i++) {
    var li = body.appendParagraph("\u2610  ");
    li.setFontFamily(s.font);
    li.editAsText().setFontFamily(0, 0, s.checkboxFont);
  }
}

/**
 * Insert an "Additional Tasks" section (HEADING2 + 7 checkbox lines) using insertParagraph.
 * Used in template/insert-index path for Batching and Ingredient Prep docs.
 * @param {Body} body  Document body
 * @param {number} idx Current insertion index
 * @returns {number}   Updated idx
 */
function insertAdditionalTasks_(body, idx) {
  var s = CFG.docStyle;
  var heading = body.insertParagraph(idx++, "Additional Tasks");
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(s.font);
  heading.editAsText().setForegroundColor(s.colors.primaryDark);
  for (var i = 0; i < 7; i++) {
    var li = body.insertParagraph(idx++, "\u2610  ");
    li.setFontFamily(s.font);
    li.editAsText().setFontFamily(0, 0, s.checkboxFont);
  }
  return idx;
}

/**
 * Append a styled data table (append-mode variant for ordering docs).
 * @param {Body} body
 * @param {string[]} headers - Column headers
 * @param {Array<string[]>} rows - Data rows
 * @param {number[]} colWidths - Column widths in points
 */
function appendDataTable_(body, headers, rows, colWidths) {
  var table = body.appendTable([headers].concat(rows));
  styleTable_(table, headers, colWidths);
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
 * REDESIGNED FORMATTING HELPERS (2026-03-23)
 *
 * Professional document formatting: tables, branded headings,
 * numbered methods, checkboxes, summary info blocks.
 * ======================================================= */

/**
 * Insert a styled data table at idx. Used for ingredient lists and ordering tables.
 * @param {Body} body
 * @param {number} idx
 * @param {string[]} headers - Column headers, e.g. ["Item", "Qty", "Unit", "☐"]
 * @param {Array<string[]>} rows - Data rows
 * @param {number[]} colWidths - Column widths in points
 * @returns {number} updated idx (idx + 1)
 */
function insertDataTable_(body, idx, headers, rows, colWidths) {
  var s = CFG.docStyle;
  var table = body.insertTable(idx, [headers].concat(rows));
  styleTable_(table, headers, colWidths);
  return idx + 1;
}

/**
 * Shared table styling logic used by both insert and append table builders.
 * Uses setAttributes() for batched property setting (performance: ~1000 fewer API calls per doc).
 */
function styleTable_(table, headers, colWidths) {
  var s = CFG.docStyle;
  var A = DocumentApp.Attribute;

  table.setBorderColor(s.table.borderColor);
  table.setBorderWidth(s.table.borderWidth);
  colWidths.forEach(function(w, i) { table.setColumnWidth(i, w); });

  // Build attribute maps once
  var headerCellAttrs = {};
  headerCellAttrs[A.BACKGROUND_COLOR] = s.table.headerBg;
  headerCellAttrs[A.PADDING_TOP] = s.table.cellPadding;
  headerCellAttrs[A.PADDING_BOTTOM] = s.table.cellPadding;
  headerCellAttrs[A.PADDING_LEFT] = s.table.cellPadding + 2;
  headerCellAttrs[A.PADDING_RIGHT] = s.table.cellPadding;

  var headerTextAttrs = {};
  headerTextAttrs[A.FOREGROUND_COLOR] = s.table.headerText;
  headerTextAttrs[A.BOLD] = true;
  headerTextAttrs[A.FONT_FAMILY] = s.font;
  headerTextAttrs[A.FONT_SIZE] = 10;

  var dataCellBase = {};
  dataCellBase[A.PADDING_TOP] = 3;
  dataCellBase[A.PADDING_BOTTOM] = 3;
  dataCellBase[A.PADDING_LEFT] = 6;
  dataCellBase[A.PADDING_RIGHT] = 4;

  var dataTextBase = {};
  dataTextBase[A.FONT_FAMILY] = s.font;
  dataTextBase[A.FONT_SIZE] = 10;
  dataTextBase[A.FOREGROUND_COLOR] = s.colors.bodyText;

  // Header row
  var headerRow = table.getRow(0);
  for (var c = 0; c < headerRow.getNumCells(); c++) {
    headerRow.getCell(c).setAttributes(headerCellAttrs);
    headerRow.getCell(c).editAsText().setAttributes(headerTextAttrs);
  }

  // Data rows (alternating backgrounds)
  for (var r = 1; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    dataCellBase[A.BACKGROUND_COLOR] = (r % 2 === 0) ? s.table.altRowBg : "#FFFFFF";
    for (var c2 = 0; c2 < row.getNumCells(); c2++) {
      row.getCell(c2).setAttributes(dataCellBase);
      if (headers[c2] === "\u2610") {
        var cbAttrs = {};
        cbAttrs[A.FONT_FAMILY] = s.checkboxFont;
        cbAttrs[A.FONT_SIZE] = 10;
        cbAttrs[A.FOREGROUND_COLOR] = s.colors.bodyText;
        row.getCell(c2).editAsText().setAttributes(cbAttrs);
      } else {
        row.getCell(c2).editAsText().setAttributes(dataTextBase);
      }
    }
  }
}

/**
 * Insert a 2-column summary info table (label | value pairs).
 * @param {Body} body
 * @param {number} idx
 * @param {Array<[string, string]>} pairs - [["Date", "Monday, 24 March"], ...]
 * @returns {number} updated idx
 */
function insertSummaryInfo_(body, idx, pairs) {
  const s = CFG.docStyle;
  const table = body.insertTable(idx, pairs);
  table.setBorderColor(s.table.borderColor);
  table.setBorderWidth(0.5);
  s.table.summaryWidths.forEach((w, i) => table.setColumnWidth(i, w));

  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    // Label column
    const labelCell = row.getCell(0);
    labelCell.setBackgroundColor("#F9F9F9");
    labelCell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(8).setPaddingRight(4);
    labelCell.editAsText().setFontFamily(s.font).setFontSize(9).setBold(true)
        .setForegroundColor(s.colors.mutedText);
    // Value column
    const valCell = row.getCell(1);
    valCell.setBackgroundColor("#FFFFFF");
    valCell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(8).setPaddingRight(4);
    valCell.editAsText().setFontFamily(s.font).setFontSize(9)
        .setForegroundColor(s.colors.bodyText);
  }

  return idx + 1;
}

/**
 * Insert method steps as a numbered list.
 * @param {Body} body
 * @param {number} idx
 * @param {string} methodText - Newline-separated method steps
 * @returns {number} updated idx
 */
function insertNumberedMethod_(body, idx, methodText) {
  if (!(methodText || "").trim()) return idx;

  body.insertParagraph(idx++, "");
  const heading = body.insertParagraph(idx++, "Method:");
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(CFG.docStyle.font);
  heading.editAsText().setForegroundColor(CFG.docStyle.colors.primaryDark);

  String(methodText).split(/\r?\n/).forEach((line) => {
    const txt = line.trim();
    if (txt) {
      const li = body.insertListItem(idx++, txt);
      li.setGlyphType(DocumentApp.GlyphType.NUMBER).setFontFamily(CFG.docStyle.font);
    }
  });

  return idx;
}

/**
 * Insert a complete item block: heading, qty, scaler, ingredient table, method, notes.
 * Consolidates the 5 previously copy-pasted rendering blocks.
 *
 * @param {Body} body
 * @param {number} idx
 * @param {Object} task - {itemName, targetQty, unit, recipeId, method, notes, batchesNeeded}
 * @param {Object} linesByRecipeId - Recipe lines map
 * @param {Object} itemsById - Items map
 * @param {Object} opts - {headingLevel, showScaler, pageBreak}
 * @returns {number} updated idx
 */
function insertItemBlock_(body, idx, task, linesByRecipeId, itemsById, opts) {
  const s = CFG.docStyle;
  const level = (opts && opts.headingLevel) || DocumentApp.ParagraphHeading.HEADING1;

  // Page break before item (except first)
  if (opts && opts.pageBreak) {
    body.insertHorizontalRule(idx++);
    body.insertPageBreak(idx++);
  }

  // Item name heading with brand color
  const namePara = body.insertParagraph(idx++, task.itemName);
  namePara.setHeading(level).setFontFamily(s.font);
  namePara.editAsText().setForegroundColor(
    level === DocumentApp.ParagraphHeading.HEADING1 ? s.colors.primary : s.colors.primaryDark
  );

  // "To Make: qty (buffer)" line
  const toMakeText = ("To Make: " + formatQtyWithBuffer_(task.targetQty, task.unit)).trim();
  const toMakePara = body.insertParagraph(idx++, toMakeText);
  toMakePara.setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontFamily(s.font);
  toMakePara.editAsText().setForegroundColor(s.colors.primaryDark);
  const baseQtyText = fmtQty_(task.targetQty) + (task.unit || "");
  appendTextWithBoldUnderline_(toMakePara, toMakeText, baseQtyText);

  // Par/stock lines (no-op, preserved for API compatibility)
  idx = insertParStockLines_(body, idx, task);

  // Scaler link
  if (!opts || opts.showScaler !== false) {
    const scalerLink = getScalerLink_(task.recipeId);
    if (scalerLink) {
      const scalerPara = body.insertParagraph(idx++, "");
      scalerPara.setFontFamily(s.font);
      scalerPara.appendText("\uD83D\uDCD0 ").setFontSize(10).setFontFamily(s.font);
      scalerPara.appendText("Scale this recipe").setLinkUrl(scalerLink)
        .setFontSize(10).setForegroundColor(s.colors.linkColor).setFontFamily(s.font);
      body.insertParagraph(idx++, "");
    }
  }

  // Ingredient table (replaces bullet list)
  var lines = task.recipeId ? (linesByRecipeId[task.recipeId] || []) : [];
  if (lines.length > 0) {
    var tableHeaders = ["Item", "Qty", "Unit", "\u2610"];
    var tableRows = [];
    lines.forEach(function(ln) {
      var comp = itemsById[ln.itemId];
      if (!comp) return;
      var compName = String(comp.fields[CFG.airtable.fields.itemName] || "(Unnamed)")
        .replace(/[\r\n]+/g, " ").trim();
      var compUnit = cellToText_(comp.fields[CFG.airtable.fields.itemUnit]) || "";
      var multiplier = task.batchesNeeded || 1;
      var total = ln.qtyPerBatch * multiplier;
      if (!Number.isFinite(total) || total === 0) return;
      tableRows.push([compName, fmtQty_(total), compUnit, "\u2610"]);
    });

    if (tableRows.length > 0) {
      var widths = [s.table.colWidths.item, s.table.colWidths.qty,
                    s.table.colWidths.unit, s.table.colWidths.check];
      idx = insertDataTable_(body, idx, tableHeaders, tableRows, widths);
    }
  } else if (task.recipeId) {
    body.insertParagraph(idx++, "No recipe lines found.").setFontFamily(s.font);
  }

  // Method (numbered steps)
  idx = insertNumberedMethod_(body, idx, task.method);

  // Notes (bold heading + plain paragraphs)
  if ((task.notes || "").trim()) {
    var notesHead = body.insertParagraph(idx++, "Notes:");
    notesHead.editAsText().setBold(true).setFontFamily(s.font);
    String(task.notes).split(/\r?\n/).forEach(function(line) {
      var txt = line.trim();
      if (txt) body.insertParagraph(idx++, txt).setFontFamily(s.font);
    });
  }

  return idx;
}
