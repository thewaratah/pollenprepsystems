# PREP SYSTEM Directory Analysis & Reorganization Plan

## Current Structure Analysis

### Core PREP SYSTEM (Keep at Top Level)

| Folder/File | Purpose | Status |
|-------------|---------|--------|
| `.claude/` | Claude Code configuration, agents, skills | Keep |
| `.planning/` | Feature planning artifacts | Keep |
| `config/` | Sensitive configuration (gitignored) | Keep |
| `docs/` | Documentation | Keep |
| `scripts/` | Core Google Apps Scripts | Keep |
| `templates/` | Google Docs templates | Keep |
| `prep-knowledge-platform/` | Next.js application | Keep |
| `CLAUDE.md` | Main documentation | Keep |
| `KnowledgeBase/` | RAG source content (recipes, SOPs, training) | Keep |

### External Tools to Move → `reference/`

| Current Location | Move To | Purpose |
|------------------|---------|---------|
| `DeepClaude/` | `reference/claude-tools/` | Claude enhancement tool |
| `SuperClaude_Framework/` | `reference/claude-tools/` | Claude framework |
| `awesome-claude-code-subagents/` | `reference/claude-tools/` | Subagent library |
| `claude-code-templates/` | `reference/claude-tools/` | Template library |
| `claude-flow/` | `reference/claude-tools/` | Flow orchestration |
| `awesome-llm-apps/` | `reference/llm-patterns/` | LLM patterns |
| `supabase-js/` | `reference/integrations/` | Supabase JS SDK |
| `supabase-mcp/` | `reference/integrations/` | Supabase MCP server |

### Documents to Move → `docs/`

| Current Location | Move To |
|------------------|---------|
| `PREP-System-Intermediate-Guide.docx` | `docs/guides/` |
| `PREP-System-Quick-Start-Guide.docx` | `docs/guides/` |

### Assets to Move → Application

| Current Location | Move To |
|------------------|---------|
| `SakuraHouseVisualAssets/` | `prep-knowledge-platform/public/brand/` |

### Files to Review/Clean

| File/Folder | Action |
|-------------|--------|
| `RAGFiles/` | Review - contains FERMENTATION reference files |
| `ragfiles_ingest.log` | Delete - temporary log file |
| `.DS_Store` files | Delete all - macOS artifacts |

---

## Proposed New Structure

```
PREP SYSTEM/
├── .claude/                          # Claude Code configuration
│   ├── agents/prep-system/           # PREP AGENT specialized agents
│   ├── mcp.json                      # MCP server configuration
│   └── skills/                       # Local development skills
│
├── .planning/                        # Feature planning artifacts
│
├── config/                           # Sensitive configuration (GITIGNORED)
│
├── docs/                             # Documentation
│   ├── guides/                       # User guides
│   │   ├── PREP-System-Quick-Start-Guide.docx
│   │   └── PREP-System-Intermediate-Guide.docx
│   ├── solutions/                    # Searchable solution library
│   └── *.md                          # Technical documentation
│
├── KnowledgeBase/                    # RAG source content
│   ├── 01-House-Recipes/
│   ├── 02-Bar-Standards/
│   ├── 03-SOPs/
│   ├── 04-Training-Materials/
│   ├── 05-Supplier-Specs/
│   └── 06-Scientific-Reference/
│
├── prep-knowledge-platform/          # Next.js application
│   ├── public/
│   │   └── brand/                    # Visual assets (moved from SakuraHouseVisualAssets)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/prep/             # PREP Operations API
│   │   │   │   ├── counts/           # Stocktake counts
│   │   │   │   ├── workflow/         # Workflow orchestration
│   │   │   │   └── lists/            # Prep lists
│   │   │   └── prep/                 # PREP Operations UI
│   │   │       ├── stocktake/
│   │   │       ├── ordering/
│   │   │       ├── batching/
│   │   │       └── ingredients/
│   │   └── components/prep/          # PREP UI components
│   └── supabase/                     # Supabase migrations
│
├── reference/                        # External tools & libraries
│   ├── integrations/                 # API integrations & MCP servers
│   │   ├── airtable-mcp2/
│   │   ├── python-slack-sdk/
│   │   ├── xero-mcp-server/
│   │   ├── supabase-mcp/             # MOVED from root
│   │   └── supabase-js/              # MOVED from root
│   │
│   ├── llm-patterns/                 # LLM application patterns
│   │   └── awesome-llm-apps/         # MOVED from root
│   │
│   ├── claude-tools/                 # Claude Code skills & frameworks
│   │   ├── Thinking-Claude/
│   │   ├── claudekit-skills/
│   │   ├── compound-engineering-plugin/
│   │   ├── development_tools/
│   │   ├── DeepClaude/               # MOVED from root
│   │   ├── SuperClaude_Framework/    # MOVED from root
│   │   ├── awesome-claude-code-subagents/  # MOVED from root
│   │   ├── claude-code-templates/    # MOVED from root
│   │   └── claude-flow/              # MOVED from root
│   │
│   └── COMPREHENSIVE_REPOSITORY_GUIDE.md
│
├── scripts/                          # Core Google Apps Scripts
│   ├── ClearWeeklyCount.gs
│   ├── FinaliseCount.gs
│   ├── GeneratePrepRun.gs
│   ├── GeneratePrepSheet.gs
│   ├── GoogleDocsPrepSystem.gs
│   ├── FeedbackForm.gs
│   ├── FeedbackFormUI.html
│   ├── RecipeScaler.gs
│   └── RecipeScalerUI.html
│
├── templates/                        # Google Docs templates
│
├── CLAUDE.md                         # Main documentation
└── .gitignore
```

---

## Deep Analysis: Workflow Steps

### Step 1: Finalize Stocktake (FinaliseCount.gs)

**Purpose:** Validate and finalize Weekly Counts stocktake data.

**GAS Script Logic:**
1. Query all unconfirmed Weekly Counts (`Confirmed=false`)
2. Validate all have `Stock Count` values (fail if any blank)
3. Normalize `Count Date` to minute precision
4. Set `Confirmed=true` on all records
5. Set `Count Source` to "Stocktake (Verified)"
6. Optional: Validate recipe integrity (missing recipes, broken links)
7. Write to Audit Log

**Next.js Implementation (workflow/generate/route.ts):**
```typescript
async function finalizeStocktake() {
  // 1. Find unconfirmed counts
  const unconfirmedCounts = await airtableListAll(
    'Weekly Counts',
    ['Item', 'Stock Count', 'Count Date', 'Confirmed', 'Count Source'],
    '{Confirmed}=FALSE()'
  );

  // 2. Validate all have values
  const missingCounts = unconfirmedCounts.filter(
    c => c.fields['Stock Count'] === undefined || c.fields['Stock Count'] === null
  );
  if (missingCounts.length > 0) {
    return { step: 'finalize', status: 'error', message: '...' };
  }

  // 3. Update all to Confirmed=true
  await batchUpdate('Weekly Counts', updates);
}
```

**Airtable Fields Used:**
- `Weekly Counts` table:
  - `Item` (link to Items)
  - `Stock Count` (number)
  - `Count Date` (date)
  - `Confirmed` (checkbox)
  - `Count Source` (single select: "Stocktake (Verified)")

---

### Step 2: Generate Prep Run (GeneratePrepRun.gs)

**Purpose:** Calculate shortfalls and create Prep Tasks + Ingredient Requirements.

**GAS Script Logic:**

**Phase 1-3: Load Data**
1. Find latest verified stocktake (by minute grouping - `STOCKTAKE_MINUTE_ISO`)
2. Build `onHand` snapshot from stocktake counts
3. Load Par Levels for all items

**Phase 4-6: Load References**
4. Load Items with types, suppliers, buffer multipliers
5. Load Recipes with yields
6. Load Recipe Lines (ingredients per recipe)

**Phase 7: Create Prep Run**
7. Find or create Prep Run record
   - Field: `Prep Week` (date)
   - Field: `Ready` (checkbox, default false)
   - Field: `Notes / Handover Notes` (includes `STOCKTAKE_MINUTE_ISO=...` for duplicate detection)

**Phase 8: Rebuild Mode**
8. If rebuilding existing run, delete old tasks and requirements

**Phase 9: Generate Tasks (BOM Explosion)**
9. Calculate shortfalls for Batch items: `shortfall = parQty - stockCount`
10. Create tasks for items with shortfall > 0
11. **Cascade to sub-recipes using queue:**
    ```
    queue = [top-level batches with shortfalls]
    while queue not empty:
        task = queue.pop()
        for each ingredient in recipe:
            requiredQty[ingredient] += qty * scale
            if ingredient is Sub Recipe:
                demand = requiredQty - onHand
                if demand > alreadyScheduled:
                    create task for sub-recipe
                    queue.push(sub-recipe)
    ```

**Phase 10: Create Task Records**
12. Create Prep Tasks with:
    - `Prep Run` (link)
    - `Item Needed` (link to Items)
    - `Recipe Used` (link to Recipes)
    - `Target Qty` (number)
    - `Batches Needed` (number)
    - `Suggested Qty (Buffer)` (only for Sub Recipe items, = Target × Buffer Multiplier)

**Phase 11: Create Ingredient Requirements**
13. For each task, calculate ingredient requirements:
    - Scale by target qty / yield
    - Group by recipe × ingredient
    - Include static supplier info for ordering lists

**Airtable Fields Used:**
- `Prep Runs` table:
  - `Prep Week` (date)
  - `Ready` (checkbox)
  - `Notes / Handover Notes` (long text)
  - `Prep Tasks` (link back from Prep Tasks)
  - `Ingredient Requirements` (link back)

- `Prep Tasks` table:
  - `Prep Run` (link)
  - `Item Needed` (link to Items)
  - `Recipe Used` (link to Recipes)
  - `Target Qty` (number)
  - `Batches Needed` (number)
  - `Suggested Qty (Buffer)` (number)
  - `Notes` (text)

- `Ingredient Requirements` table:
  - `Prep Run` (link)
  - `Recipe Link` (link to Recipes)
  - `Item Link` (link to Items)
  - `Total Qty Needed` (number)
  - `Supplier (Static)` (link to Supplier)
  - `Supplier Name (Static)` (text)
  - `Product Category (Static)` (text)
  - `Ordering Staff (Static)` (text)

---

### Step 3: Trigger Export (GeneratePrepSheet.gs → GoogleDocsPrepSystem.gs)

**Purpose:** Set export request state and trigger GAS to create Google Docs.

**Trigger Logic (GeneratePrepSheet.gs):**
1. Set `Export Request State` = "REQUESTED" (single select)
2. Set `Export Mode` = "LIVE" or "TEST" (single select)
3. Set `Export Notify Slack` = true/false (checkbox)
4. Set `Export Requested At` = now (date)

**Export Logic (GoogleDocsPrepSystem.gs):**
1. GAS time-trigger polls Prep Runs for `Export Request State = "REQUESTED"`
2. Processes oldest request first
3. Creates 4 Google Docs:
   - Ingredient Prep List (sub-recipes grouped by batch)
   - Batching List (batch tasks with ingredients)
   - Gooch Ordering List (grouped by supplier)
   - Sabs Ordering List (grouped by supplier)
4. Updates `Export Request State` = "DONE"
5. Writes folder URL to `Link to Prep Guides`
6. Sends Slack notifications (if enabled)

**Airtable Fields Used:**
- `Prep Runs` table (Export fields):
  - `Export Request State` (single select: REQUESTED, IN_PROGRESS, DONE, FAILED)
  - `Export Mode` (single select: LIVE, TEST)
  - `Export Notify Slack` (checkbox)
  - `Export Requested At` (date)
  - `Export Finished At` (date)
  - `Export Last Error` (text)
  - `Export Last Result` (long text - JSON)
  - `Link to Prep Guides` (URL)

---

## Naming Conventions

### Airtable Tables
- PascalCase with spaces: `Weekly Counts`, `Prep Runs`, `Recipe Lines`

### Airtable Fields
- Title Case with spaces: `Stock Count`, `Item Name`, `Export Request State`
- Static snapshot fields: `Supplier Name (Static)`, `Ordering Staff (Static)`
- Buffer fields: `Suggested Qty (Buffer)`

### API Routes
- kebab-case paths: `/api/prep/counts`, `/api/prep/workflow/generate`
- RESTful methods: GET (read), POST (create), PATCH (update), DELETE (remove)

### TypeScript
- camelCase for variables and functions: `airtableListAll`, `batchCreate`
- PascalCase for interfaces: `AirtableRecord`, `WorkflowResult`
- UPPER_CASE for constants: `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`

### GAS Scripts
- camelCase for functions: `formatSydneyTimestamp_`, `batchUpdate_`
- Trailing underscore for private helpers: `writeAuditLog_`
- UPPER_CASE CONFIG object with nested keys

---

## Recommended Actions

### Immediate (Do Now)
1. ✅ Fix Airtable field names in workflow/generate (DONE)
2. Move `.docx` files to `docs/guides/`
3. Move `SakuraHouseVisualAssets/` to `prep-knowledge-platform/public/brand/`
4. Delete `ragfiles_ingest.log`

### Short-term (This Week)
5. Move external tools to `reference/` subdirectories
6. Update CLAUDE.md folder architecture section
7. Update `.gitignore` to exclude reference/ from tracking

### Medium-term (Optional)
8. Add recipe validation to Next.js workflow (like GAS FinaliseCount)
9. Add audit logging to Next.js workflow
10. Add duplicate detection (STOCKTAKE_MINUTE_ISO) to prevent re-runs

---

*Analysis Date: 2026-02-01*
*Generated by: Claude Code*
