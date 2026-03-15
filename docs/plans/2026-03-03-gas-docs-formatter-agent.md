# Plan: GAS Google Docs Formatter Agent

**Date:** 2026-03-03
**Author:** prep-orchestrator (read-only analysis)
**Status:** Ready for review — no files created yet

---

## Research Summary

### Stream A — Agent & Command Inventory

**Existing agents** (13 total, in `.claude/agents/`):

| Agent | What it covers |
|-------|---------------|
| `waratah-prep-agent` | All Waratah GAS + Airtable code changes |
| `sakura-prep-agent` | All Sakura GAS + Airtable code changes |
| `gas-code-review-agent` | P0–P3 review of any GAS file before deploy |
| `weekly-cycle-agent` | ClearWeeklyCount, FinaliseCount, GeneratePrepRun, polling |
| `recipe-scaler-agent` | RecipeScaler.gs, RecipeScalerUI.html, /api/prep/recipes/ |
| `knowledge-platform-agent` | Next.js platform |
| `rag-knowledge-agent` | Supabase RAG |
| `slack-ordering-agent` | Slack notifications + Block Kit |
| `airtable-schema-agent` | Airtable schema, REST API |
| `airtable-mcp-agent` | Live Airtable data via MCP |
| `deployment-agent` | clasp push, vercel deploy |
| `documentation-agent` | CLAUDE.md updates |
| `prep-orchestrator` | Multi-venue coordination |

**Existing commands** (15 total, in `.claude/commands/`):
`waratah`, `sakura`, `platform`, `review`, `deploy`, `docs`, `prep`, `plan`, `orchestrate`, `weekly`, `slack`, `airtable`, `airtable-mcp`, `rag`, `scaler`

**Gap identified:** No agent or command covers Google Docs document formatting in GAS — specifically:
- DocumentApp API patterns
- Body traversal, element insertion/append
- Heading hierarchy (H1/H2/H3/SUBTITLE)
- Template copy + placeholder replacement
- Inline text styling (bold, underline, font size, colour, link)
- List items, bullets, horizontal rules, page breaks
- The hybrid template engine (v4.2) used by GoogleDocsPrepSystem.gs

The `waratah-prep-agent` is the closest match but is intentionally broad. When formatting work
becomes the focus (e.g. adding new document sections, fixing heading structure, adding new
inline styled elements), a dedicated agent with a compact, pre-loaded DocumentApp API cheatsheet
would avoid re-deriving these patterns from scratch every session.

**Agent file format (from existing agents):**

```yaml
---
name: agent-name
description: One sentence description of when to invoke this agent.
tools: Read, Glob, Grep, Bash, Edit, Write, TodoWrite
---

# Agent Name

## Role
...

## Critical Rules
### P0 — Will break production if violated
...

## Output Format
1. ...
```

---

### Stream B — Reference Folder

**`Reference/COMPREHENSIVE_REPOSITORY_GUIDE.md`** — covers 20 external repos (Xero, Slack, Airtable/Ruby, ElizaOS, n8n, Claude tools). No GAS or DocumentApp content.

**`Reference/automation/`** — contains: `awesome-n8n-templates`, `airtable-mcp2`, `python-slack-sdk`, `supabase-js`, `supabase-mcp`, `xero-mcp-server`. No GAS.

**`Reference/integrations/`** — similar; Python/JS API clients. No GAS.

**`Reference/llm-patterns/`** — AI agent frameworks, RAG tutorials, multi-agent patterns. No GAS.

**`Reference/plugin-prep-airtable/`** — Airtable MCP plugin. No GAS.

**`Reference/claude-tools/`** — Claude Code templates, Thinking-Claude, compound-engineering-plugin, awesome-claude-code-subagents. No GAS-specific material.

**Conclusion for Stream B:** There are **no locally cloned GAS reference repositories** in this project. The Reference folder is entirely focused on API clients, LLM patterns, and Claude tooling. All GAS knowledge must come from:
1. The existing `GoogleDocsPrepSystem.gs` code itself (excellent source — ~2,600 lines)
2. Embedded API cheatsheet in the agent file
3. Pointer to official GAS docs (runtime ref only — no internet access at write time)

**awesome-claude-code-subagents** categories present: `01-core-development`, `02-language-specialists`, `03-infrastructure`, `04-quality-security`, `05-data-ai`, `06-developer-experience`, `07-specialized-domains`, `08-business-product`, `09-meta-orchestration`, `10-research-analysis`. Likely contains agent file template format examples worth checking for pattern inspiration (format already confirmed via existing agents above).

---

### Stream C — GoogleDocsPrepSystem.gs Formatting Pattern Catalogue

Complete inventory of every DocumentApp formatting technique used in
`/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/The Waratah/scripts/GoogleDocsPrepSystem.gs`
(v4.2, ~2,650 lines):

#### 1. Document Creation & Lifecycle

| Pattern | Code |
|---------|------|
| Create new blank doc | `DocumentApp.create(title)` |
| Open doc by ID | `DocumentApp.openById(id)` |
| Get doc body | `doc.getBody()` |
| Clear body content | `body.clearContent()` — NOTE: NEVER `body.clear()` |
| Save and close | `doc.saveAndClose()` |
| Get doc ID | `doc.getId()` |

#### 2. Template Copy Pattern (Hybrid Engine v4.2)

| Pattern | Code |
|---------|------|
| Copy template file | `DriveApp.getFileById(templateId).makeCopy(newName, folder)` |
| Open copy as Doc | `DocumentApp.openById(copy.getId())` |
| Replace text placeholders | `body.replaceText(escapedPattern, value)` |
| Find content marker | `body.findText("\\{\\{CONTENT\\}\\}")` |
| Get element from search | `searchResult.getElement()` |
| Walk to body-level parent | loop `parent = parent.getParent()` until `BODY_SECTION` |
| Get insertion index | `body.getChildIndex(parent)` |
| Remove placeholder element | `body.removeChild(parent)` |

#### 3. Paragraph Insertion (Insert-Index Path — template flow)

| Pattern | Code |
|---------|------|
| Insert plain paragraph | `body.insertParagraph(idx++, text)` |
| Insert as HEADING1 | `.setHeading(DocumentApp.ParagraphHeading.HEADING1)` |
| Insert as HEADING2 | `.setHeading(DocumentApp.ParagraphHeading.HEADING2)` |
| Insert as HEADING3 | `.setHeading(DocumentApp.ParagraphHeading.HEADING3)` |
| Insert as SUBTITLE | `.setHeading(DocumentApp.ParagraphHeading.SUBTITLE)` |
| Insert blank spacer | `body.insertParagraph(idx++, "")` |
| Insert horizontal rule | `body.insertHorizontalRule(idx++)` |
| Insert page break | `body.insertPageBreak(idx++)` |
| Set paragraph indent | `para.setIndentStart(36)` |
| Set spacing after | `para.setSpacingAfter(8)` |

#### 4. Paragraph Append (Append Path — programmatic fallback)

| Pattern | Code |
|---------|------|
| Append paragraph | `body.appendParagraph(text)` |
| Append with heading | `body.appendParagraph(text).setHeading(...)` |
| Append horizontal rule | `body.appendHorizontalRule()` |
| Append page break | `body.appendPageBreak()` |

#### 5. List Items

| Pattern | Code |
|---------|------|
| Insert bullet (template path) | `body.insertListItem(idx++, text)` then `.setGlyphType(DocumentApp.GlyphType.BULLET)` |
| Append bullet (fallback path) | `body.appendListItem(text)` then `.setGlyphType(DocumentApp.GlyphType.BULLET)` |
| Helper function `appendBullet_` | wraps `appendListItem` + `setGlyphType.BULLET` |

#### 6. Inline Text Styling

| Pattern | Code |
|---------|------|
| Get Text object from paragraph | `paragraph.editAsText()` |
| Set bold on range | `text.setBold(startIdx, endIdx, true)` |
| Set underline on range | `text.setUnderline(startIdx, endIdx, true)` |
| Set bold on whole paragraph text | `para.editAsText().setBold(true)` |
| Set font size | `.setFontSize(10)` |
| Set foreground colour | `.setForegroundColor("#007AFF")` |
| Set link URL | `.setLinkUrl(url)` |
| Append text segment to para | `para.appendText("text string")` — returns Text object |
| Chained append with style | `para.appendText("text").setFontSize(10).setForegroundColor("#007AFF")` |

The `appendTextWithBoldUnderline_` helper:
```javascript
function appendTextWithBoldUnderline_(paragraph, fullText, boldUnderlineText) {
  const text = paragraph.editAsText();
  const startIndex = fullText.indexOf(boldUnderlineText);
  if (startIndex === -1) return;
  const endIndex = startIndex + boldUnderlineText.length - 1;
  text.setBold(startIndex, endIndex, true);
  text.setUnderline(startIndex, endIndex, true);
}
```
Used extensively: the base quantity `"3862ml"` inside `"Item Name 3862ml (1.5x = 5793ml)"` is bolded+underlined.

#### 7. Header and Footer Replacement

| Pattern | Code |
|---------|------|
| Get header section | `doc.getHeader()` |
| Get footer section | `doc.getFooter()` |
| Replace text in header | `headers.replaceText(pattern, value)` |
| Null-check before use | `if (headers) { headers.replaceText(...) }` |

#### 8. Element Traversal and Removal

| Pattern | Code |
|---------|------|
| Get child count | `body.getNumChildren()` |
| Get child by index | `body.getChild(i)` |
| Get element type | `child.getType()` |
| Check for paragraph type | `=== DocumentApp.ElementType.PARAGRAPH` |
| Check for table type | `=== DocumentApp.ElementType.TABLE` |
| Check for body section | `=== DocumentApp.ElementType.BODY_SECTION` |
| Get text from element | `child.asText().getText()` |
| Remove child | `body.removeChild(body.getChild(idx))` — always reverse-iterate |
| Get parent | `element.getParent()` |

#### 9. Table Traversal (for template cleanup)

| Pattern | Code |
|---------|------|
| Cast to table | `child.asTable()` |
| Get row count | `table.getNumRows()` |
| Get row | `table.getRow(r)` |
| Get cell count | `row.getNumCells()` |
| Get cell text | `row.getCell(c).getText()` |

#### 10. Drive and File Operations

| Pattern | Code |
|---------|------|
| Get folder by ID | `DriveApp.getFolderById(id)` |
| Create subfolder | `folder.createFolder(name)` |
| Find folders by name | `folder.getFoldersByName(name)` / `.hasNext()` / `.next()` |
| Get file by ID | `DriveApp.getFileById(fileId)` |
| Make file copy | `file.makeCopy(newName, folder)` |
| Move file to folder | `folder.addFile(file)` |
| Remove from root | `DriveApp.getRootFolder().removeFile(file)` |
| Trash file by name | `folder.getFilesByName(name)` → `file.setTrashed(true)` |
| Set folder sharing | `folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW)` |

#### 11. Regex and Text Helpers

| Pattern | Code |
|---------|------|
| Escape regex for replaceText | `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` |
| Remove all mustache markers | `body.replaceText("\\{\\{[A-Za-z_#/0-9]+\\}\\}", "")` |
| Multiline text split | `String(text).split(/\r?\n/)` |
| Normalise line endings | `.replace(/[\r\n]+/g, " ").trim()` |

#### 12. Formatting Utility Functions

| Function | Purpose |
|----------|---------|
| `fmtQty_(n)` | Format number: integer if whole, 2dp if fractional; empty string if NaN |
| `formatQtyWithBuffer_(qty, unit)` | Returns `"Xunit (1.5x = Yunit)"` string for display |
| `formatRunLabel_(run)` | `"yyyy-MM-dd"` from Prep Week field |
| `formatRunDateLong_(run)` | `"EEEE, d MMMM yyyy"` from Prep Week field |
| `formatWeekEndingLabel_(run)` | `"W.E. DD/MM/YYYY"` (Monday + 6 days = Sunday) |
| `formatNow_()` | Current Sydney time as `"yyyy-MM-dd HH:mm"` |
| `appendTextWithBoldUnderline_` | Bold+underline a substring within a paragraph |
| `insertParStockLines_` | Insert HEADING3 par-level/stock lines at index (template path) |
| `appendParStockLines_` | Append HEADING3 par-level/stock lines (fallback path) |
| `insertFeedbackLink_` | Insert styled feedback link paragraph at index |
| `appendFeedbackLink_` | Append styled feedback link paragraph |
| `getScalerLink_` | Build recipe scaler URL with recipeId param |
| `appendBullet_` | Append a BULLET list item |
| `appendMultiline_` | Append multi-line text splitting on \n |

#### 13. Known GAS Gotchas (from production experience in this codebase)

| Gotcha | Detail |
|--------|--------|
| `KEEP_WITH_NEXT` does not exist in GAS | `DocumentApp.Attribute.KEEP_WITH_NEXT` resolves to `undefined` — will throw if used in `setAttributes()`. Use `PAGE_BREAK_BEFORE` instead. |
| Reverse-iterate when removing elements | Forward removal shifts indices causing missed elements or index errors. Always collect indices first, then remove in reverse. |
| `body.clear()` destroys formatting | P0 rule: always `body.clearContent()` |
| `replaceText` takes regex, not literal | Must escape special chars with `escapeRegex_()` |
| Header/footer may be null | Always null-check `doc.getHeader()` and `doc.getFooter()` before calling `.replaceText()` |
| Body must have at least 1 child | Guard `body.getNumChildren() > 1` before any `removeChild()` |
| Element type checking before `asText()` | Wrap in try/catch — some element types don't support `asText()` |
| `copyTemplate_` returns a `Document`, not a `File` | `DriveApp.getFileById(templateId).makeCopy()` returns a File; chain `DocumentApp.openById(copy.getId())` to get the Document |

---

### Stream D — Remote GAS Repository Status

No GAS reference repositories are cloned locally in the Reference folder. Confirmed search returned zero results for:
- `apps-script-samples`
- `apps-script-starter`
- `apps-script-oauth2`
- `tanaikech`
- `google-apps-script-awesome-list`
- Any `.gs` files outside the project's own scripts directories

The Reference folder contains only: Xero/Slack/Airtable API clients (Ruby/Python/PHP/JS), LLM/AI agent patterns, Claude Code tools. None are GAS-relevant.

**Implication:** The agent cannot point to a locally cloned cheatsheet. All DocumentApp API knowledge must be embedded directly in the agent file as inline reference tables (as done above in Stream C). This is the right approach — the agent file itself becomes the living cheatsheet, updated as new patterns are encountered.

---

## Agent Design

### Role
`gas-docs-formatter-agent` is a specialist for writing and editing Google Apps Script code that
generates or modifies Google Docs documents. It understands the DocumentApp/Body/Paragraph/Text
APIs, the hybrid template engine pattern used in GoogleDocsPrepSystem.gs, and all PREP system
formatting conventions.

### When to Invoke
- Any task that involves modifying how a prep document looks or is structured
- Adding new document sections (e.g. new heading type, new data block)
- Fixing or extending the hybrid template engine (v4.2)
- Adding new formatting helpers (`insertXxx_`, `appendXxx_`)
- Debugging GAS DocumentApp errors (wrong element type, missing method, index shifting)
- Extending `insertParStockLines_` / `appendParStockLines_` with new metadata fields
- Creating a new document type (e.g. a 5th output document)

### What It Does NOT Cover
- Airtable data fetching (that's `waratah-prep-agent` / `airtable-schema-agent`)
- Slack notifications (that's `slack-ordering-agent`)
- Deployment (`deployment-agent`)
- Template visual design / branding changes (those happen in Google Docs directly, not in code)

### Relationship to Existing Agents

```
gas-docs-formatter-agent
  ← invoked BY: waratah-prep-agent, sakura-prep-agent, prep-orchestrator
  → gates on: gas-code-review-agent (before any deploy)
  → defers to: deployment-agent (clasp push)
  → defers to: waratah-prep-agent for Airtable data shape questions
```

The formatter agent fills a precise gap: it holds the DocumentApp API knowledge so venue agents
don't need to re-derive it. A venue agent can say "add a new section after the method block" and
delegate the exact GAS Document API implementation to this agent.

---

## Slash Command Design

**Command:** `/gas-docs [task]`

**Purpose:** Invoke `gas-docs-formatter-agent` for any Google Docs formatting task in GAS.

**Input:** Natural language description of the formatting change needed, optionally with:
- Which document type (Batching, Ingredient Prep, Ordering, new type)
- Which path (template/insert-index path, programmatic/append path, or both)
- Which venue (affects which `GoogleDocsPrepSystem.gs` file)

---

## Knowledge Sources

The agent should embed the following knowledge directly (no external URLs):

1. **Inline DocumentApp API cheatsheet** — the catalogue from Stream C above (tables 1–13).
   This is the most valuable part: pre-loaded so the agent never needs to re-read the source file
   to find basic API calls.

2. **Pointer to read first:** `The Waratah/scripts/GoogleDocsPrepSystem.gs` — the agent must
   read the relevant function(s) before making any change, to understand local conventions and
   the exact insert-index vs append-path symmetry.

3. **Pointer to read:** `Sakura House/scripts/GoogleDocsPrepSystem.gs` — Sakura has the same
   hybrid engine; confirm the change applies there too if requested.

4. **Hybrid template engine diagram** (embedded in agent) — the v4.2 flow: template copy →
   replace placeholders → find {{CONTENT}} marker → get insertIndex → remove marker element →
   insert feedback link → programmatic content insertion → cleanupMarkers_.

5. **Known gotchas** (from Stream C table 13) — embedded in the agent file.

---

## Full Draft: `.claude/agents/gas-docs-formatter-agent.md`

```markdown
---
name: gas-docs-formatter-agent
description: Use for any task involving Google Docs formatting in GAS — adding document sections, fixing heading structure, extending the hybrid template engine, writing new insertXxx_/appendXxx_ helpers, or debugging DocumentApp API errors. Holds a complete DocumentApp API cheatsheet for the PREP system context. Gate all deploys on gas-code-review-agent then deployment-agent.
tools: Read, Glob, Grep, Bash, Edit, Write, TodoWrite
---

# GAS Google Docs Formatter Agent — PREP System

## Role

You are the Google Docs formatting specialist for the PREP system. You write and edit GAS code
that generates and modifies Google Docs documents inside `GoogleDocsPrepSystem.gs` (both venues).
You have deep knowledge of the DocumentApp API, the hybrid template engine (v4.2), and every
formatting convention established in this codebase.

You do not handle Airtable data fetching, Slack notifications, or deployment. Gate all GAS code
changes on `gas-code-review-agent`, then `deployment-agent`.

---

## FIRST STEP — Always

Read the relevant function(s) in the target `GoogleDocsPrepSystem.gs` before making any change.
The insert-index path (template) and append path (programmatic fallback) must always remain in
sync — a change to one requires the matching change in the other.

- Waratah: `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/The Waratah/scripts/GoogleDocsPrepSystem.gs`
- Sakura: `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/Sakura House/scripts/GoogleDocsPrepSystem.gs`

---

## Document Architecture

The PREP system generates 4 document types per run. Each uses the hybrid template engine (v4.2):

| Document | Template prop key | Fallback function |
|----------|------------------|-------------------|
| Ingredient Prep Run Sheet | `WARATAH_TEMPLATE_INGREDIENT_PREP_ID` | `createOrReplaceIngredientPrepDoc_` |
| Batching Run Sheet | `WARATAH_TEMPLATE_BATCHING_ID` | `createOrReplaceBatchingDoc_` |
| Andie Ordering Run Sheet | `WARATAH_TEMPLATE_ANDIE_ORDERING_ID` | `createOrReplaceOrderingDoc_` |
| Blade Ordering Run Sheet | `WARATAH_TEMPLATE_BLADE_ORDERING_ID` | `createOrReplaceOrderingDoc_` |

Each document has two code paths that must stay in sync:
- **Template path** (`createXxxFromTemplate_`): uses insert-index (`body.insertParagraph(idx++, ...)`)
- **Programmatic fallback** (`createOrReplaceXxx_`): uses append (`body.appendParagraph(...)`)

---

## Hybrid Template Engine v4.2

```
1. copyTemplate_(templateId, folder, title)
   → DriveApp.getFileById(templateId).makeCopy(newName, folder)
   → DocumentApp.openById(copy.getId())

2. replaceAllPlaceholders_(doc, { DATE, RUN_LABEL, STAFF_NAME })
   → body.replaceText(escapeRegex_("{{KEY}}"), value)
   → Also replaces in doc.getHeader() and doc.getFooter() if present

3. Find {{CONTENT}} marker
   → body.findText("{{CONTENT}}")
   → Walk parent chain until body-level element
   → insertIndex = body.getChildIndex(parent)
   → body.removeChild(parent)

4. insertFeedbackLink_(body, insertIndex, runId, docType, staffRole)
   → Inserts styled feedback paragraph at insertIndex
   → Returns insertIndex + 1

5. Programmatic content insertion at insertIndex
   → All content uses body.insertParagraph(idx++, ...) / body.insertListItem(idx++, ...)

6. cleanupMarkers_(body)
   → removeAllTemplateElements_(body) — removes any remaining loop structures
   → body.replaceText("\\{\\{[A-Za-z_#/0-9]+\\}\\}", "") — removes remaining markers
   → Remove empty paragraphs (reverse-iterate)

7. doc.saveAndClose()
```

---

## DocumentApp API Cheatsheet

### Document Lifecycle

| Operation | Code |
|-----------|------|
| Create blank doc | `DocumentApp.create(title)` |
| Open by ID | `DocumentApp.openById(id)` |
| Get body | `doc.getBody()` |
| Clear body content | `body.clearContent()` — NEVER `body.clear()` (destroys formatting) |
| Save and close | `doc.saveAndClose()` |
| Get doc ID | `doc.getId()` |

### Paragraph Insertion (Insert-Index Path)

| Operation | Code |
|-----------|------|
| Insert paragraph | `body.insertParagraph(idx++, text)` |
| Set heading | `.setHeading(DocumentApp.ParagraphHeading.HEADING1)` |
| Available headings | `HEADING1`, `HEADING2`, `HEADING3`, `HEADING4`, `HEADING5`, `HEADING6`, `SUBTITLE`, `NORMAL` |
| Insert blank spacer | `body.insertParagraph(idx++, "")` |
| Insert horizontal rule | `body.insertHorizontalRule(idx++)` |
| Insert page break | `body.insertPageBreak(idx++)` |
| Set indent | `.setIndentStart(36)` |
| Set spacing after | `.setSpacingAfter(8)` |

### Paragraph Append (Programmatic Fallback Path)

| Operation | Code |
|-----------|------|
| Append paragraph | `body.appendParagraph(text)` |
| Append with heading | `body.appendParagraph(text).setHeading(...)` |
| Append horizontal rule | `body.appendHorizontalRule()` |
| Append page break | `body.appendPageBreak()` |

### List Items

| Operation | Code |
|-----------|------|
| Insert bullet (template path) | `const li = body.insertListItem(idx++, text); li.setGlyphType(DocumentApp.GlyphType.BULLET)` |
| Append bullet (fallback path) | `const li = body.appendListItem(text); li.setGlyphType(DocumentApp.GlyphType.BULLET)` |
| Helper `appendBullet_(body, text)` | wraps appendListItem + BULLET glyph |

### Inline Text Styling

| Operation | Code |
|-----------|------|
| Get Text object | `paragraph.editAsText()` |
| Bold a range | `text.setBold(startIdx, endIdx, true)` |
| Underline a range | `text.setUnderline(startIdx, endIdx, true)` |
| Bold whole paragraph | `para.editAsText().setBold(true)` |
| Set font size | `.setFontSize(10)` |
| Set foreground colour | `.setForegroundColor("#007AFF")` |
| Set link URL | `.setLinkUrl(url)` |
| Underline | `.setUnderline(true)` |
| Append styled text segment | `para.appendText("text").setFontSize(10).setForegroundColor("#007AFF")` |

### Header and Footer

| Operation | Code |
|-----------|------|
| Get header | `doc.getHeader()` — may be null |
| Get footer | `doc.getFooter()` — may be null |
| Replace text in header | `if (headers) { headers.replaceText(pattern, value) }` |

### Element Traversal and Removal

| Operation | Code |
|-----------|------|
| Get child count | `body.getNumChildren()` |
| Get child at index | `body.getChild(i)` |
| Get element type | `child.getType()` |
| Paragraph type check | `=== DocumentApp.ElementType.PARAGRAPH` |
| Table type check | `=== DocumentApp.ElementType.TABLE` |
| Body section check | `=== DocumentApp.ElementType.BODY_SECTION` |
| Get text content | `child.asText().getText()` — wrap in try/catch |
| Remove child | `body.removeChild(body.getChild(idx))` — always reverse-iterate |
| Get parent | `element.getParent()` |
| Get child index | `body.getChildIndex(element)` |

### Table Traversal

| Operation | Code |
|-----------|------|
| Cast to table | `child.asTable()` |
| Row count | `table.getNumRows()` |
| Get row | `table.getRow(r)` |
| Cell count | `row.getNumCells()` |
| Cell text | `row.getCell(c).getText()` |

### Drive File Operations

| Operation | Code |
|-----------|------|
| Get folder | `DriveApp.getFolderById(id)` |
| Create subfolder | `folder.createFolder(name)` |
| Find subfolder | `folder.getFoldersByName(name)` → `.hasNext()` / `.next()` |
| Copy file to folder | `DriveApp.getFileById(id).makeCopy(newName, folder)` |
| Open copy as Doc | `DocumentApp.openById(copy.getId())` |
| Move file | `folder.addFile(file); DriveApp.getRootFolder().removeFile(file)` |
| Trash by name | `folder.getFilesByName(name)` → `file.setTrashed(true)` |
| Set folder sharing | `folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW)` |

---

## Known Gotchas (Production-Verified)

| Gotcha | Safe Pattern |
|--------|-------------|
| `KEEP_WITH_NEXT` does not exist in GAS DocumentApp | Use `PAGE_BREAK_BEFORE` attribute or `body.insertPageBreak(idx++)` instead. `DocumentApp.Attribute.KEEP_WITH_NEXT` is undefined and throws when passed to `setAttributes()`. |
| Reverse-iterate when removing elements | Collect indices into `toRemove[]`, then `for (let i = toRemove.length - 1; i >= 0; i--)` |
| `body.clear()` destroys formatting | Always `body.clearContent()`. P0 rule. |
| `replaceText` uses regex, not literal | Escape with `escapeRegex_()`: `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` |
| Header/footer may be null | Always `if (headers) { ... }` before calling methods |
| Body must have at least 1 child | Guard `if (body.getNumChildren() > 1)` before any `removeChild()` |
| `asText()` not available on all element types | Wrap in try/catch when iterating mixed element types |
| `copyTemplate_` returns File, not Document | `file.makeCopy()` → `DocumentApp.openById(copy.getId())` |
| Insert-index path and append path must stay in sync | Every formatting addition has TWO implementations |

---

## Existing Formatting Helpers (Do Not Duplicate)

| Helper | Purpose | Location |
|--------|---------|---------|
| `appendTextWithBoldUnderline_(para, fullText, boldText)` | Bold+underline a substring in a paragraph | GoogleDocsPrepSystem.gs |
| `insertParStockLines_(body, idx, task)` | HEADING3 par level / stock / parent batch lines (insert path) | GoogleDocsPrepSystem.gs |
| `appendParStockLines_(body, task)` | Same as above (append path) | GoogleDocsPrepSystem.gs |
| `insertFeedbackLink_(body, idx, runId, docType, staffRole)` | Feedback link paragraph (insert path) | GoogleDocsPrepSystem.gs |
| `appendFeedbackLink_(body, runId, docType, staffRole)` | Same (append path) | GoogleDocsPrepSystem.gs |
| `getScalerLink_(recipeId)` | Build recipe scaler URL | GoogleDocsPrepSystem.gs |
| `appendBullet_(body, text)` | Append BULLET list item | GoogleDocsPrepSystem.gs |
| `appendMultiline_(body, text)` | Split on \\n and append each line | GoogleDocsPrepSystem.gs |
| `fmtQty_(n)` | Number → string (integer or 2dp) | GoogleDocsPrepSystem.gs |
| `formatQtyWithBuffer_(qty, unit)` | `"Xunit (1.5x = Yunit)"` | GoogleDocsPrepSystem.gs |
| `formatWeekEndingLabel_(run)` | `"W.E. DD/MM/YYYY"` | GoogleDocsPrepSystem.gs |
| `cleanupMarkers_(body)` | Remove all template markers and empty paragraphs | GoogleDocsPrepSystem.gs |
| `removeAllTemplateElements_(body)` | Remove mustache loop structures | GoogleDocsPrepSystem.gs |
| `removeElementsContainingText_(body, text)` | Remove elements containing specific text | GoogleDocsPrepSystem.gs |
| `replaceAllPlaceholders_(doc, data)` | Replace `{{KEY}}` placeholders in body+header+footer | GoogleDocsPrepSystem.gs |
| `escapeRegex_(str)` | Escape regex special chars for `replaceText` | GoogleDocsPrepSystem.gs |

---

## Workflow for Any Formatting Task

1. Identify which document type(s) are affected
2. Identify which path(s): template (`createXxxFromTemplate_`) and/or programmatic (`createOrReplaceXxx_`)
3. Read the relevant function(s) in full before writing any code
4. Implement the change — both paths if the doc type has both
5. Verify the insert-index / append symmetry is maintained
6. Check the Known Gotchas table before finalising
7. Invoke `gas-code-review-agent` before suggesting deploy

## Critical Rules

### P0 — Block Deployment

- Never use `body.clear()` — always `body.clearContent()`
- Never use `DocumentApp.Attribute.KEEP_WITH_NEXT` — it doesn't exist in GAS (returns undefined, throws)
- All new template property keys must be documented in the relevant venue's CLAUDE.md
- Never add hardcoded Google Doc IDs or folder IDs — must come from Script Properties via `getProp_()` or `getOptionalProp_()`

### P1 — Fix Before Merge

- Always maintain insert-index / append symmetry — both template and fallback paths must produce equivalent output
- Reverse-iterate before removing elements — forward iteration corrupts indices
- Null-check `doc.getHeader()` and `doc.getFooter()` before calling `.replaceText()`
- Guard `body.getNumChildren() > 1` before any `removeChild()`

### P2 — Fix Soon

- New helper functions must follow the `insertXxx_` / `appendXxx_` naming symmetry
- Functions over 50 lines should be decomposed
- Use `Logger.log()` not `console.log()`

---

## Output Format

Return:
1. **Document type(s) affected** — which of the 4 doc types changed
2. **Path(s) modified** — template path / programmatic fallback / both
3. **Functions changed** — list with line numbers
4. **Insert-index / append symmetry check** — explicit confirmation both paths updated
5. **Known gotchas checked** — confirm none of the 9 gotchas apply (or flag if they do)
6. **Next step** — `gas-code-review-agent` then `deployment-agent`
```

---

## Full Draft: `.claude/commands/gas-docs.md`

```markdown
Use the `gas-docs-formatter-agent` sub-agent to handle this Google Docs formatting task in GAS:

$ARGUMENTS

The agent specialises in DocumentApp API patterns, the hybrid template engine (v4.2), and the
insert-index / append path symmetry used in GoogleDocsPrepSystem.gs. It holds a complete
DocumentApp cheatsheet inline. It will read the relevant function(s) before making any change,
maintain both code paths, and gate the result on gas-code-review-agent before deployment.
```

---

## Gaps and Decisions Needed

### Decision 1 — Scope: Both venues or Waratah-only?

The agent draft above is written to cover both `GoogleDocsPrepSystem.gs` files (Waratah +
Sakura). Both files share the same hybrid engine (v4.2). The Sakura version should be
structurally identical but uses different ordering staff names (Gooch/Sabs) and field names.

**Question for user:** Should `/gas-docs` be scoped to both venues or Waratah-first?
- If both venues: the command file should say "specify the venue" in the prompt
- If Waratah-only: rename to `/gas-docs-waratah` and add a companion `/gas-docs-sakura`

**Recommendation:** Cover both venues with a single agent. The agent reads the relevant file
based on the task description. Less duplication.

### Decision 2 — Trigger condition in CLAUDE.md routing table

The main `CLAUDE.md` routing table does not yet include a trigger for `gas-docs-formatter-agent`.
A suitable trigger row would be:

```
| GAS code in GoogleDocsPrepSystem.gs touches DocumentApp/Body/Paragraph formatting | `gas-docs-formatter-agent` |
```

This is a narrow scope. An alternative is to keep routing via `waratah-prep-agent` /
`sakura-prep-agent` and have those agents explicitly sub-delegate to `gas-docs-formatter-agent`
when the task is purely about document formatting. This avoids adding another routing rule to the
already-long main CLAUDE.md.

**Recommendation:** Sub-delegation approach. Add a note to `waratah-prep-agent.md` and
`sakura-prep-agent.md`: "For DocumentApp formatting tasks in GoogleDocsPrepSystem.gs, delegate to
`gas-docs-formatter-agent`."

### Decision 3 — Should the agent write code directly or report-only?

The existing `gas-code-review-agent` is report-only. Most implementation agents (waratah, sakura,
recipe-scaler) can write code (`tools: Read, Glob, Grep, Bash, Edit, Write, TodoWrite`).

For the formatter agent: it should write code (tools include `Edit` and `Write`), gated on
`gas-code-review-agent` before any deploy suggestion. This matches the waratah/sakura agent
pattern.

**Recommendation:** Full write access (same tools list as `waratah-prep-agent`).

### Decision 4 — Sakura GoogleDocsPrepSystem.gs analysis needed

This plan was based entirely on the Waratah version. The Sakura version may have structural
differences in how the 4 documents are generated (different doc titles, different content
ordering, different fallback behaviour). Before creating the files, the user may want to confirm
whether Sakura's `GoogleDocsPrepSystem.gs` is structurally equivalent or diverges significantly.

If they diverge, the agent may need venue-specific sections.

---

## Implementation Plan (when user approves)

These files need to be created (no code changes required):

1. `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/agents/gas-docs-formatter-agent.md`
   — Full draft above (section "Full Draft: `.claude/agents/gas-docs-formatter-agent.md`")

2. `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/commands/gas-docs.md`
   — Full draft above (section "Full Draft: `.claude/commands/gas-docs.md`")

3. Update `waratah-prep-agent.md` — add one line: "For DocumentApp formatting tasks in
   GoogleDocsPrepSystem.gs, sub-delegate to `gas-docs-formatter-agent`"

4. Update `sakura-prep-agent.md` — same addition

5. Update main `CLAUDE.md` routing table — add trigger row for `gas-docs-formatter-agent`
   (optional, per Decision 2)

6. Update `documentation-agent.md` — note that `gas-docs-formatter-agent.md` is a new file to
   maintain when `GoogleDocsPrepSystem.gs` formatting patterns change

All six steps are documentation/agent instruction work only. No GAS scripts, Airtable automations,
or Next.js code are modified.

---

## Reference: Files Read During This Analysis

- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/The Waratah/scripts/GoogleDocsPrepSystem.gs` (all 2,650+ lines)
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/agents/waratah-prep-agent.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/agents/sakura-prep-agent.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/agents/gas-code-review-agent.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/agents/recipe-scaler-agent.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/agents/weekly-cycle-agent.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/commands/waratah.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/commands/review.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/commands/scaler.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/.claude/commands/deploy.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/Reference/COMPREHENSIVE_REPOSITORY_GUIDE.md`
- `/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/The Waratah/CLAUDE.md` (via system reminder)
