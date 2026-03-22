# PREP SYSTEMS — Navigation Guide

**Last Updated:** 2026-03-23
**Project Type:** Multi-venue kitchen prep automation (Airtable + GAS + Google Docs + Slack)
**Venues:** Sakura House, The Waratah

---

## Agent Pipeline

**Claude must execute this pipeline automatically on every task — no user prompt required.**
Agents live in `.claude/agents/` and are invoked via the Task tool.

### Phase 1: GATE (before touching any code)

Run these checks first. If a gate matches, dispatch that agent and **wait for it to complete** before proceeding.

| Match | Agent | Rule |
|-------|-------|------|
| Task spans both venues OR 3+ files across venues | `prep-orchestrator` | **STOP.** Delegate entirely — orchestrator will route, parallelise, and call back. Do not proceed to Phase 2 yourself. |
| Files match `*ClearWeeklyCount*`, `*FinaliseCount*`, `*TimeBasedPolling*` | `weekly-cycle-agent` | **HIGH RISK.** Never edit these files without this agent. It validates timing, sequencing, and data safety. |
| Unsure which agent handles the task | `prep-orchestrator` | When in doubt, orchestrate. |

### Phase 2: ROUTE (dispatch the right specialist)

Match the task against these patterns. **Dispatch the first match.** If multiple independent specialists match (e.g., Slack change + Airtable schema change), dispatch them **in parallel** using a single message with multiple Task tool calls.

| File Pattern / Domain | Agent | Context |
|-----------------------|-------|---------|
| `Sakura House/**` | `sakura-prep-agent` | Reads `Sakura House/CLAUDE.md` first |
| `The Waratah/**` | `waratah-prep-agent` | Reads `The Waratah/CLAUDE.md` first |
| `*Slack*`, `*webhook*`, `*Block Kit*`, `SLACK_WEBHOOK_*` | `slack-ordering-agent` | Validates staff names + webhook vars per venue |
| Airtable table/field/view changes, REST API patterns | `airtable-schema-agent` | Finds all affected scripts before changing schema |
| Live Airtable record queries, data inspection | `airtable-mcp-agent` | Read-only data access via MCP |
| `RecipeScaler.gs`, `RecipeScalerUI.html` | `recipe-scaler-agent` | Verifies per-venue web app URL |
| `GoogleDocsPrepSystem.gs` formatting, `insertXxx_`/`appendXxx_` | `gas-docs-formatter-agent` | DocumentApp API + template engine v4.2 |
| Cross-venue Airtable schema audit | `airtable-mcp-agent` | Via `/audit` command |

### Phase 3: CHECK (after code changes, before reporting complete)

**Every task that modified code must pass these checks.** Run all matching checks — they are independent and can run in parallel.

| Condition | Agent | What happens if it fails |
|-----------|-------|--------------------------|
| Any `.gs` file was edited | `gas-code-review-agent` | **Do not report work complete.** Fix all P0/P1 issues first, then re-run review. P2/P3 issues: report to user as suggestions. |
| A Tier 1 or Tier 2 shared file was edited | `parity-check-agent` | If backport needed: dispatch the other venue's agent to apply the fix. Report parity status to user. |
| Any code or behaviour changed | `documentation-agent` | Updates relevant `CLAUDE.md` + venue docs. Must run before Phase 4. |

**Tier 1/2 shared files** (see `docs/SHARED_PATTERNS_REGISTRY.md`): `PrepUtils.gs`, `PrepConfig.gs`, `PrepDocFormatting.gs`, `PrepDocGenerators.gs`, `GoogleDocsPrepSystem.gs`, `FeedbackForm.gs`, `RecipeScaler.gs`

### Phase 4: DEPLOY (only when user requests deployment)

These run sequentially — each step gates the next. **Abort on any failure.**

```
1. documentation-agent  →  Verify all docs updated (blocks if not)
2. gas-code-review-agent  →  Must have a passing report on all changed .gs files
3. deployment-agent  →  Pre-deploy checklist:
   ├── Verify .claspignore excludes Waratah_*.gs (P0)
   ├── Verify correct .clasp.json scriptId for venue
   ├── clasp status (confirm only intended files deploy)
   ├── clasp push --force
   └── Post-deploy health check
```

### Parallel Dispatch Rules

**When to parallelise (single message, multiple Task calls):**
- Two independent venue changes → `sakura-prep-agent` + `waratah-prep-agent` in parallel
- Phase 3 checks after code change → `gas-code-review-agent` + `parity-check-agent` in parallel
- Independent domain specialists → e.g., `slack-ordering-agent` + `airtable-schema-agent` in parallel

**When NOT to parallelise (sequential only):**
- Phase 4 deploy steps — each gates the next
- `weekly-cycle-agent` — always runs alone (high-risk scripts)
- Any agent that depends on another agent's output

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/prep [task]` | Orchestrator plans + routes a multi-step task end-to-end |
| `/plan [feature]` | Orchestrator plans without writing code (read-only analysis) |
| `/orchestrate [task]` | Orchestrator plans + executes full end-to-end with all agents |
| `/sakura [task]` | Dispatch sakura-prep-agent |
| `/waratah [task]` | Dispatch waratah-prep-agent |
| `/review [files]` | Run gas-code-review-agent on changed files |
| `/deploy [venue]` | Run deployment checklist + clasp push |
| `/docs [what changed]` | Patch affected CLAUDE.md files |
| `/weekly [task]` | Weekly cycle scripts — ClearWeeklyCount, FinaliseCount, polling |
| `/slack [task]` | Slack ordering notifications + Block Kit design |
| `/airtable [task]` | Airtable base schema, linked records, REST API patterns |
| `/airtable-mcp [task]` | Live Airtable record queries via MCP (read/inspect data, not schema) |
| `/scaler [task]` | Recipe Scaler GAS + UI |
| `/gas-docs [task]` | Google Docs formatting in GAS — DocumentApp API, hybrid template engine, insertXxx_/appendXxx_ helpers |
| `/parity [scope]` | Cross-venue parity check — detects missing backports between venues (`all`, `utilities`, or filename) |
| `/audit [scope]` | Cross-venue Airtable schema comparison via MCP (defaults to Items + Recipes tables) |
| `/update-scripts-docs [what changed]` | Update Sakura Advanced Script & Automation docs after script changes |
| `/push-advanced-docs` | Push Sakura Advanced Script & Automation docs to Google Drive (manual only) |
| `/push-waratah-advanced-docs` | Push Waratah Advanced Script & Automation docs to Google Drive (manual only) |
| `/schema-export` | Export both venues' Airtable schemas to a Google Sheet with parity comparison tab |
| `/backup-scripts [venue]` | Back up venue scripts (.gs → .txt) to Google Drive via MCP (`waratah`, `sakura`, or `both`) |

---

## Which Guide Do You Need?

**Documentation is split to avoid token limits.**

### Working on SAKURA HOUSE?
→ **Read [`Sakura House/CLAUDE.md`](Sakura%20House/CLAUDE.md)** ✅ Production Ready
- Scripts: `ClearWeeklyCount.gs`, `ClearPrepData.gs`, `FinaliseCount.gs`, `GeneratePrepRun.gs`, `GoogleDocsPrepSystem.gs`
- Recipe name field: `Recipe Name` (plain text)
- Ordering staff: Gooch, Sabs

### Working on THE WARATAH?
→ **Read [`The Waratah/CLAUDE.md`](The%20Waratah/CLAUDE.md)** ✅ Production Ready
- Scripts: `Waratah_*.gs` (Airtable), `GoogleDocsPrepSystem.gs`, `RecipeScaler.gs`, `FeedbackForm.gs` (GAS)
- Recipe name field: `Item Name` (linked record → Items table)
- Ordering staff: Andie, Blade
- `.claspignore` excludes all `Waratah_*.gs` from GAS deployment

---

## Project Structure

```
PREP Systems/
├── Sakura House/
│   ├── scripts/                  # GAS + Airtable scripts (no Waratah_ prefix)
│   ├── docs/                     # AIRTABLE_SCHEMA.md, guides, plans
│   └── CLAUDE.md                 # Sakura guide
├── The Waratah/
│   ├── scripts/                  # GAS scripts + Waratah_*.gs Airtable scripts
│   ├── plans/                    # Feature plans (stock-count-ordering-plan.md)
│   └── CLAUDE.md                 # Waratah guide
├── .claude/
│   ├── agents/                   # 12 specialist agents
│   └── commands/                 # 15 slash commands
├── .mcp.json                     # MCP server config (GITIGNORED — OAuth credentials)
└── CLAUDE.md                     # This navigation file (you are here)
```

---

## Key Differences Between Venues

| Feature | Sakura House | The Waratah |
|---------|--------------|-------------|
| **Airtable Base** | `appNsFRhuU47e9qlR` | `appfcy14ZikhKZnRS` |
| **GAS Script ID** | `1ALLTzQ44TDvekiQ...` | `10Ox7eE9-ReUCIpGR...` |
| **Recipe name field** | `Recipe Name` (text) | `Item Name` (linked record → Items) |
| **Ordering staff** | Gooch, Sabs | Andie, Blade |
| **Script prefix** | None | `Waratah_` for Airtable scripts |
| **`.claspignore`** | Not required | Required — excludes `Waratah_*.gs` |
| **Item types** | Standard | `"Batch"`, `"Sub Recipe"`, `"Sub-recipe"` (all 3 required) |
| **Weekly cycle** | Fri AM clear → Sat AM reset → Sat shift (count/generate/order) → Sun–Wed (delivery/prep) | Mon–Fri cycle |
| **Status** | Production ✅ | Production ✅ |

---

## Common Operations

### For Sakura House:
- GAS scripts: `Sakura House/scripts/`
- Deploy: `cd "Sakura House/scripts" && clasp push --force`

### For The Waratah:
- GAS scripts: `The Waratah/scripts/` (only non-`Waratah_*.gs` files go to GAS)
- Deploy GAS: `cd "The Waratah/scripts" && clasp push --force`
- Verify `.claspignore` first: `clasp status` should NOT show `Waratah_*.gs`

### For Both Venues:
- Sakura workflow: ClearPrepData (Fri 8 AM) → ClearWeeklyCount (Sat 8 AM) → Sat shift: count → finalise → generate → export → order → Sun–Wed: deliveries + prep
- Waratah workflow: Stocktake Sunday → Mon AM automation → Ordering before 2pm Mon → Deliveries Tue → Prep Tue–Wed

---

## External Tooling
*MCP servers and CLI tools available for Google Workspace operations.*

### Google Workspace MCP
Configured in `.mcp.json` at project root. Gives Claude direct read/write access to Google Docs, Drive, and Sheets via MCP protocol. Uses `uvx workspace-mcp --tool-tier core`. Authenticated as `evan@pollenhospitality.com`.

**`.mcp.json` is gitignored** — it contains OAuth credentials and must never be committed.

### `gws` CLI (v0.18.1)
Installed globally via `npm install -g @googleworkspace/cli`. Terminal CLI for all Google Workspace APIs (Drive, Docs, Sheets, Gmail, Calendar). Authenticated with the same OAuth credentials as the MCP server.

```bash
# Examples
gws drive files list --params '{"pageSize": 10}'
gws docs documents get --documentId "<DOC_ID>"
gws sheets spreadsheets get --spreadsheetId "<SHEET_ID>"
```

### Airtable MCP
Configured in `.mcp.json`. Provides live read access to Airtable bases via `search_bases`, `list_tables_for_base`, `list_records_for_table`, etc. Used by `airtable-mcp-agent` for data inspection and cross-venue schema audits.

### Airtable Schema Reference (Google Sheet)
Live export of both venues' complete Airtable schemas: [PREP Systems — Airtable Schema Reference](https://docs.google.com/spreadsheets/d/1mBZsJwDogZQk0OGU527KGEKE8Nui85ZF9UatHM9IC-I/edit). Three tabs: Waratah (25 tables), Sakura House (17 tables), Schema Parity (differences only). Re-generate with `/schema-export`.

### Script Backups (Google Drive)
Scripts backed up as `.txt` files for reference and manual Airtable paste:
- **Waratah:** [Script Backups](https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp) — 14 scripts (9 Airtable + 5 GAS)
- **Sakura:** [Script Backups](https://drive.google.com/drive/folders/1ATD1g3YlyC-lOYVhfWuDuXlBJr1Mm1Om) — 12 scripts (5 Airtable + 5 GAS + 2 web apps)
- Re-sync with `/backup-scripts` (both), `/backup-scripts waratah`, or `/backup-scripts sakura`

---

## Critical Rules

1. **Never cross-contaminate venue data** — Andie/Blade in Sakura code or Gooch/Sabs in Waratah code is a P1 error
2. **Waratah: always verify `.claspignore`** before any `clasp push` — uploading `Waratah_*.gs` to GAS causes duplicate function name errors (P0)
3. **Waratah recipes: use `Item Name` (linked record), never `Recipe Name`** — that field does not exist in Waratah
4. **All credentials via Script Properties** — no hardcoded base IDs, PATs, webhook URLs, or API keys in code (P0)
5. **`clearContent()` not `clear()`** — `clear()` destroys formatting and validations (P0)

---

## Development Guidelines

**Before working on any code:**
1. **Identify the venue** — Sakura or Waratah?
2. **Read the appropriate guide** — don't try to load everything at once
3. **Identify the code environment** — Airtable automation vs GAS vs Google Docs
4. **Check the agent routing table above** — which specialist should handle this?
5. **Test on copies** — never test destructive operations (ClearWeeklyCount, FinaliseCount) on production data

---

**Status:** Both venues fully operational and production-ready ✅
**Last Updated:** 2026-03-23
