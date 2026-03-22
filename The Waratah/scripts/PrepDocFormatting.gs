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
