# PREP SYSTEMS — Navigation Guide

**Last Updated:** 2026-03-21
**Project Type:** Multi-venue kitchen prep automation (Airtable + GAS + Google Docs + Slack)
**Venues:** Sakura House, The Waratah

---

## Agent Auto-Routing Rules

**Claude must follow these dispatch rules automatically — no user prompt required.**

| Trigger | Agent to dispatch |
|---------|------------------|
| Any task touching Sakura House files | `sakura-prep-agent` |
| Any task touching Waratah files | `waratah-prep-agent` |
| Task spans both venues | `prep-orchestrator` → parallelises into both venue agents |
| After any GAS code change (>5 lines modified) | `gas-code-review-agent` before reporting work complete |
| Before any `clasp push` | `documentation-agent` → then `deployment-agent` |
| Any CLAUDE.md / doc update | `documentation-agent` |
| Multi-step feature with 3+ files across venues | `prep-orchestrator` |
| Waratah `.claspignore` or GAS deployment | `deployment-agent` — verify `.claspignore` excludes `Waratah_*.gs` (P0) |
| Weekly cycle: `ClearWeeklyCount`, `FinaliseCount`, time-based polling | `weekly-cycle-agent` — high-risk, never edit standalone |
| Slack notifications, webhook config, Block Kit | `slack-ordering-agent` |
| Airtable base schema, linked records, views, REST API | `airtable-schema-agent` |
| Live Airtable data access, querying records via MCP | `airtable-mcp-agent` |
| Recipe Scaler (`RecipeScaler.gs`) | `recipe-scaler-agent` |

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

---

## Agent Auto-Use Rules

Specialist agents live in `.claude/agents/`. Claude invokes them via the Task tool. The following rules apply to every session — no manual invocation needed:

| Condition | Agent to invoke |
|-----------|----------------|
| Any `.gs` file edited | `gas-code-review-agent` before reporting work complete |
| Task touches both venues | `prep-orchestrator` first to parallelise |
| Weekly count or time-based polling script changed | `weekly-cycle-agent` — never edit these standalone |
| Slack notification added or changed | `slack-ordering-agent` — check staff names and webhook vars |
| Airtable schema, table, or field changed | `airtable-schema-agent` — find all affected scripts first |
| Recipe Scaler backend or UI changed | `recipe-scaler-agent` — verify per-venue web app URL |
| Significant code change completed | `documentation-agent` to update relevant CLAUDE.md + docs |
| Ready to `clasp push` | `documentation-agent` first, then `deployment-agent` pre-deploy checklist |
| Waratah: any GAS deployment | `documentation-agent` first, then `deployment-agent` — verify `.claspignore` before every push |

**Single entry point for non-trivial tasks:** describe the task to `prep-orchestrator` and it will route and parallelise automatically.

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
│   ├── agents/                   # 13 specialist agents
│   └── commands/                 # 14 slash commands
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
**Last Updated:** 2026-03-21
