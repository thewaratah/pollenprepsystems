/****************************************************
 * PREP SYSTEM — UTILITIES
 * Part of the GoogleDocsPrepSystem split (PrepUtils.gs)
 * Airtable REST API, Drive helpers, pure utility functions
 ****************************************************/

/* =========================================================
 * SCRIPT PROPERTY HELPERS
 * ======================================================= */

function getOptionalProp_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v || !String(v).trim()) return null;
  return String(v).trim();
}

function getProp_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v || !String(v).trim()) throw new Error(`Missing Script Property: ${name}`);
  return String(v).trim();
}

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
 * PURE UTILITIES
 * ======================================================= */

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
