# Multi-Venue Architecture Analysis

**Date:** 2026-02-12
**Status:** Analysis Complete, Awaiting Implementation

---

## Current State Assessment

### What Exists Today

#### Venue 1: Sakura House (Original)
```
PREP SYSTEM/
├── prep-knowledge-platform/          # Next.js app with venue abstraction
│   ├── src/lib/venues.ts             # ✅ Venue config abstraction
│   ├── src/lib/api-venue.ts          # ✅ Request-based venue resolution
│   ├── src/lib/airtable.ts           # ✅ Accepts baseId parameter
│   └── .env.local                    # NEXT_PUBLIC_VENUE_ID=sakura
├── scripts/                          # ⚠️ SHARED Google Apps Scripts
│   ├── GoogleDocsPrepSystem.gs       # Used by BOTH venues
│   ├── FeedbackForm.gs
│   ├── RecipeScaler.gs
│   ├── ClearWeeklyCount.gs
│   ├── FinaliseCount.gs
│   └── GeneratePrepRun.gs
└── .claude/                          # ✅ Shared agents/skills
```

#### Venue 2: The Waratah (Duplicate)
```
PREP SYSTEM/THE WARATAH/
├── prep-knowledge-platform/          # ❌ COMPLETE DUPLICATION
│   ├── src/                          # Same code as Sakura
│   ├── .env                          # NEXT_PUBLIC_VENUE_ID=waratah
│   └── Different Supabase/Airtable bases
├── scripts/                          # ❌ DUPLICATED SCRIPTS
│   └── [Same 10 scripts as root]
└── config/                           # Venue-specific credentials
```

---

## Problems with Current Architecture

### 🔴 Critical Issues

1. **Complete Code Duplication**
   - THE WARATAH folder duplicates 100% of prep-knowledge-platform
   - Bug fixes require changes in TWO places
   - Features deployed twice, manually
   - Version drift guaranteed

2. **Google Apps Scripts Shared Unsafely**
   - Both venues use THE SAME GAS deployment
   - Script Properties mix Sakura + Waratah config
   - One deployment serves two completely different Airtable bases
   - Risk of cross-venue data corruption

3. **No Clean Separation**
   - Unclear what should be shared vs isolated
   - No documented boundaries
   - Hard to add Venue 3 without more duplication

### 🟡 Moderate Issues

4. **Deployment Confusion**
   - Two Next.js apps to maintain
   - Unclear which is "production"
   - Different Vercel projects needed

5. **Configuration Sprawl**
   - Environment variables duplicated
   - Some in .env, some in .env.local
   - Hard to track what's different per venue

---

## Agent-Native Architecture Principles Applied

### Principle 1: Parity
**Whatever a user can do through the UI, the agent should be able to achieve through tools.**

✅ **Already Implemented:**
- `/api/chat` endpoint with 15+ operational tools
- Tools for stocktake, prep runs, recipes, export
- RAG knowledge base with 87K+ chunks

✅ **Venue-Aware:**
- Agents can work with either venue via `x-venue-id` header
- Tools accept `baseId` parameter dynamically

🔵 **Recommendation:** Maintain parity across venues
- Same tools available for Sakura and Waratah
- Agent behavior should adapt to venue context
- No venue-specific tool restrictions

### Principle 2: Granularity
**Prefer atomic primitives. Features are outcomes achieved by an agent operating in a loop.**

✅ **Good Granularity:**
```typescript
// Airtable.ts properly accepts baseId - atomic!
export async function getStocktakeStatus(baseId: string): Promise<StocktakeStatus>
export async function lookupRecipe(baseId: string, nameOrId: string): Promise<Recipe>
```

❌ **Too Coupled:**
```javascript
// GoogleDocsPrepSystem.gs hardcodes venue selection
const baseId = PropertiesService.getScriptProperties().getProperty('AIRTABLE_BASE_ID');
// Which venue? Sakura or Waratah?
```

🔵 **Recommendation:**
- Keep Next.js tools venue-agnostic (already done ✅)
- Refactor GAS scripts to accept venue parameter
- Agent chooses venue, tools execute

### Principle 3: Composability
**New features can be added via prompts alone.**

✅ **Works Today:**
```
Agent: "Generate prep run for Waratah"
System: Resolves venue → Uses waratah baseId → Executes workflow
```

🔵 **Future:**
```
Agent: "Compare Sakura vs Waratah usage trends"
System: Queries both bases → Synthesizes comparison → Returns insights
```

Requires: Clean abstraction, no hardcoded assumptions

### Principle 4: Emergent Capability
**The agent can accomplish things you didn't explicitly design for.**

✅ **Example - Cross-Venue Analysis:**
User: "Which venue uses more Wasabi Mayo per week?"

Agent should be able to:
1. Identify both venue baseIds
2. Query prep runs from both
3. Aggregate ingredient requirements
4. Compare and report

**Requirements:**
- Venue discovery (list available venues)
- Cross-venue data access (with proper auth)
- No hardcoded venue logic in tools

---

## Recommended Architecture

### Option A: Monorepo with Shared Code (RECOMMENDED)

```
PREP SYSTEM/
├── apps/
│   ├── prep-knowledge-platform/     # Shared Next.js app
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── venues.ts        # Venue registry (Sakura, Waratah)
│   │   │   │   ├── airtable.ts      # Venue-agnostic (accepts baseId)
│   │   │   │   └── api-venue.ts     # Request context resolution
│   │   │   └── app/
│   │   │       └── api/             # All APIs venue-aware
│   │   ├── .env.sakura              # Sakura environment
│   │   ├── .env.waratah             # Waratah environment
│   │   └── package.json
│   │
│   └── gas-scripts/                 # Google Apps Scripts (shared code)
│       ├── shared/                  # Common functions
│       │   ├── airtable-client.gs   # Generic Airtable operations
│       │   ├── doc-generator.gs     # Generic doc creation
│       │   └── slack-notifier.gs    # Generic Slack sending
│       ├── sakura/                  # Sakura-specific deployment
│       │   ├── .clasp.json          # Sakura GAS project ID
│       │   ├── main.gs              # Imports shared, sets Sakura config
│       │   └── appsscript.json
│       └── waratah/                 # Waratah-specific deployment
│           ├── .clasp.json          # Waratah GAS project ID
│           ├── main.gs              # Imports shared, sets Waratah config
│           └── appsscript.json
│
├── venues/                          # Venue-specific configurations
│   ├── sakura/
│   │   ├── config.json              # Sakura-specific settings
│   │   ├── credentials.env          # Sakura secrets (gitignored)
│   │   └── README.md                # Sakura-specific notes
│   └── waratah/
│       ├── config.json              # Waratah-specific settings
│       ├── credentials.env          # Waratah secrets (gitignored)
│       └── README.md                # Waratah-specific notes
│
├── .claude/                         # ✅ SHARED across venues
│   ├── agents/
│   │   └── prep-system/             # All 13 agents
│   └── skills/                      # All skills
│
├── docs/                            # ✅ SHARED documentation
│   └── solutions/                   # Solution patterns apply to both
│
└── reference/                       # ✅ SHARED reference materials
```

### Deployment Strategy

**Next.js App:**
```bash
# Single codebase, multiple deployments
vercel --prod --env-file=.env.sakura   # → sakura-prep.vercel.app
vercel --prod --env-file=.env.waratah  # → waratah-prep.vercel.app
```

**Google Apps Scripts:**
```bash
# Sakura deployment
cd apps/gas-scripts/sakura
clasp push  # → Pushes shared + Sakura main.gs

# Waratah deployment
cd apps/gas-scripts/waratah
clasp push  # → Pushes shared + Waratah main.gs
```

---

## What Gets Shared vs Separated

### ✅ SHARED (Same code for all venues)

| Component | Why Shared |
|-----------|------------|
| Next.js app code | Business logic is identical |
| Airtable integration | Same API patterns, different baseId |
| RAG system | Same knowledge retrieval patterns |
| Agent definitions | Same intelligence layer |
| Skills | Same development workflows |
| GAS shared functions | Same automation logic |
| Documentation | Same processes |

### 🔒 ISOLATED (Separate per venue)

| Component | Why Isolated |
|-----------|--------------|
| Airtable Base ID | Different data, different schema |
| Supabase instance | Different knowledge bases |
| Google Drive folder | Different document storage |
| Slack webhooks | Different notification channels |
| GAS deployment | Different script execution context |
| Environment variables | Different credentials |

### 🎯 VENUE-AWARE (Shared code, venue-selected behavior)

| Component | How It Works |
|-----------|--------------|
| API endpoints | Read `x-venue-id` header or query param |
| Airtable queries | Accept `baseId` parameter |
| RAG searches | Use `{venueId}_rag_chunks` table |
| Slack notifications | Use venue config for webhooks |
| Document generation | Use venue theme (colors, logo) |

---

## Implementation Plan

### Phase 1: Consolidate Next.js App (1 day)

1. **Keep only root prep-knowledge-platform**
   ```bash
   # Backup Waratah changes (if any unique)
   diff -r prep-knowledge-platform THE\ WARATAH/prep-knowledge-platform > waratah-changes.patch

   # Delete duplicate
   rm -rf "THE WARATAH/prep-knowledge-platform"
   ```

2. **Create venue-specific .env files**
   ```bash
   mv prep-knowledge-platform/.env.local prep-knowledge-platform/.env.sakura
   mv "THE WARATAH/prep-knowledge-platform/.env" prep-knowledge-platform/.env.waratah
   ```

3. **Deploy both venues from same codebase**
   ```bash
   vercel --prod --env-file=.env.sakura
   vercel --prod --env-file=.env.waratah
   ```

### Phase 2: Separate Google Apps Scripts (2 days)

1. **Create shared functions library**
   ```bash
   mkdir -p apps/gas-scripts/shared
   # Extract common code from GoogleDocsPrepSystem.gs
   # Move to shared/airtable-client.gs, shared/doc-generator.gs, etc.
   ```

2. **Create venue-specific deployments**
   ```bash
   # Sakura
   mkdir -p apps/gas-scripts/sakura
   clasp create --type standalone --title "PREP System - Sakura House"

   # Waratah
   mkdir -p apps/gas-scripts/waratah
   clasp create --type standalone --title "PREP System - The Waratah"
   ```

3. **Configure Script Properties per venue**
   - Each deployment gets its own properties
   - No mixing of credentials
   - Clear separation of concerns

### Phase 3: Agent Testing (1 day)

1. **Verify parity across venues**
   ```
   Test: "What's the stocktake status?"
   - Works for Sakura (default)
   - Works for Waratah (with x-venue-id header)
   ```

2. **Test emergent capabilities**
   ```
   Test: "Compare Wasabi Mayo usage between venues"
   Agent should:
   - Query both bases
   - Aggregate data
   - Provide comparison
   ```

3. **Test cross-venue operations**
   ```
   Test: "Generate prep run for Waratah, then export"
   Agent should:
   - Select correct base
   - Use correct GAS webhook
   - Notify correct Slack channel
   ```

### Phase 4: Documentation (1 day)

1. **Update CLAUDE.md**
   - Multi-venue architecture section
   - How to add Venue 3
   - Agent venue selection patterns

2. **Create venue-specific READMEs**
   - venues/sakura/README.md
   - venues/waratah/README.md

3. **Document deployment process**
   - How to deploy Next.js for new venue
   - How to deploy GAS for new venue
   - Environment variable checklist

---

## Adding Venue 3 (Future)

With the recommended architecture, adding a new venue is:

1. **Add venue config** (5 minutes)
   ```typescript
   // venues.ts
   export const VENUES = {
     sakura: { ... },
     waratah: { ... },
     newvenue: {
       id: 'newvenue',
       displayName: 'New Venue Name',
       airtableBaseId: 'appXXXXXXXXXXXXXX',
       supabasePrefix: 'newvenue_',
       // ...
     }
   };
   ```

2. **Create credentials** (10 minutes)
   ```bash
   cp .env.sakura .env.newvenue
   # Edit with new venue credentials
   ```

3. **Deploy Next.js** (5 minutes)
   ```bash
   vercel --prod --env-file=.env.newvenue
   ```

4. **Deploy GAS** (15 minutes)
   ```bash
   mkdir apps/gas-scripts/newvenue
   cd apps/gas-scripts/newvenue
   clasp create
   # Copy main.gs from sakura, update config
   clasp push
   ```

**Total time: ~35 minutes** (vs hours of duplication today)

---

## Agent/Skill Sharing Strategy

### What Agents/Skills See

All agents have access to:

1. **Venue Registry**
   ```
   Available venues:
   - sakura (Sakura House) - appNsFRhuU47e9qlR
   - waratah (The Waratah) - wspB1DzuXWuxEAhCD

   Default: sakura
   Override: x-venue-id header or ?venueId= param
   ```

2. **Same Tool Definitions**
   ```
   Tools:
   - get_stocktake_status(venueId?) → Defaults to current venue
   - lookup_recipe(venueId?, recipeId)
   - generate_prep_run(venueId?)
   - export_prep_docs(venueId?, mode)
   ```

3. **Same Knowledge Base Structure**
   - Both venues have `{venueId}_rag_chunks` tables
   - Same schema, different data
   - Agent searches appropriate venue's knowledge

### Venue Selection Logic

**Agent System Prompt Includes:**
```markdown
## Venue Selection

You are working in a multi-venue system. Unless the user specifies a venue,
use the default venue from the current context.

Available venues:
- **Sakura House** (`sakura`) - Original Japanese restaurant
- **The Waratah** (`waratah`) - New Australian venue

To query a specific venue, use the `venueId` parameter in tool calls.

Examples:
- "What's the stocktake status?" → Use default venue
- "What's the stocktake status for Waratah?" → Use venueId='waratah'
- "Compare prep times between venues" → Query both venues
```

### Skill Reusability

✅ **These skills work for ALL venues:**
- `/brainstorming` - Venue-agnostic ideation
- `/debugging` - Same debugging patterns
- `/backend-development` - Same GAS patterns
- `/create-plans` - Same planning workflow
- `/compound-docs` - Solutions apply to both

❌ **These skills DON'T need duplication:**
- No venue-specific versions needed
- Skills operate on whatever venue context is provided

🔵 **Future Enhancement:**
```markdown
# Venue-Specific Skills (Optional)

If a venue has truly unique workflows:

.claude/
├── skills/
│   ├── debugging.md              # ✅ Shared
│   ├── brainstorming.md          # ✅ Shared
│   └── expertise/
│       ├── prep-system/          # ✅ Shared prep knowledge
│       ├── sakura-house/         # 🔵 Sakura-specific (if needed)
│       └── waratah/              # 🔵 Waratah-specific (if needed)
```

---

## Testing Multi-Venue Setup

### Test Suite

1. **Venue Isolation**
   ```bash
   # Test 1: Sakura stocktake doesn't see Waratah data
   curl /api/prep/counts -H "x-venue-id: sakura"
   # Should return Sakura items only

   # Test 2: Waratah stocktake doesn't see Sakura data
   curl /api/prep/counts -H "x-venue-id: waratah"
   # Should return Waratah items only
   ```

2. **Agent Venue Selection**
   ```
   Chat: "What's the stocktake status?"
   → Should ask which venue (if ambiguous)
   → Or use default from context

   Chat: "What's the stocktake status for Waratah?"
   → Should automatically select waratah baseId
   → Should return Waratah data
   ```

3. **Cross-Venue Queries**
   ```
   Chat: "Which venue has more prep tasks this week?"
   → Should query both venues
   → Should compare and report
   ```

4. **RAG Knowledge Separation**
   ```
   Chat: "Tell me about the Miso Glaze recipe" (default Sakura)
   → Searches sakura_rag_chunks

   Chat: "Tell me about Waratah's signature dessert"
   → Searches waratah_rag_chunks
   ```

5. **GAS Webhook Separation**
   ```
   # Test export for Sakura
   POST /api/prep/workflow/generate
   Headers: x-venue-id: sakura
   → Calls SAKURA_GAS_WEBAPP_URL
   → Notifies SLACK_WEBHOOK_SAKURA_PREP

   # Test export for Waratah
   POST /api/prep/workflow/generate
   Headers: x-venue-id: waratah
   → Calls WARATAH_GAS_WEBAPP_URL
   → Notifies SLACK_WEBHOOK_WARATAH_PREP
   ```

---

## Migration Checklist

### Before Migration
- [ ] Backup THE WARATAH folder completely
- [ ] Document any Waratah-specific customizations
- [ ] Export all Waratah environment variables
- [ ] Test Waratah deployment works standalone

### During Migration
- [ ] Consolidate Next.js apps
- [ ] Create venue-specific .env files
- [ ] Deploy both venues from single codebase
- [ ] Separate Google Apps Scripts
- [ ] Create shared GAS functions
- [ ] Deploy Sakura GAS project
- [ ] Deploy Waratah GAS project
- [ ] Update webhook URLs in Airtable
- [ ] Update CLAUDE.md documentation

### After Migration
- [ ] Test Sakura end-to-end workflow
- [ ] Test Waratah end-to-end workflow
- [ ] Test agent venue selection
- [ ] Test cross-venue queries
- [ ] Delete THE WARATAH folder
- [ ] Update deployment scripts
- [ ] Train team on new structure

---

## Benefits of Recommended Architecture

### For Development
- ✅ Fix bugs once, applies to all venues
- ✅ Add features once, deploy everywhere
- ✅ Clear boundaries between shared/isolated
- ✅ Easy to add Venue 3, 4, 5...

### For Agent Intelligence
- ✅ Agents understand multi-venue context
- ✅ Cross-venue analysis possible
- ✅ Emergent capabilities across venues
- ✅ Single knowledge base abstraction

### For Operations
- ✅ No duplicate maintenance
- ✅ Consistent deployment process
- ✅ Version control for everything
- ✅ Clear audit trail per venue

### For Future Growth
- ✅ Add venues in 35 minutes
- ✅ Scale to 10+ venues easily
- ✅ Franchise-ready architecture
- ✅ White-label potential

---

## Questions to Answer

Before proceeding with implementation:

1. **Are there Waratah-specific customizations?**
   - Different menu items requiring unique logic?
   - Different workflow steps?
   - Different UI requirements?

2. **Should venues share a Supabase instance?**
   - Option A: Single Supabase, prefixed tables (current)
   - Option B: Separate Supabase per venue (more isolated)

3. **How should agents default to a venue?**
   - Option A: User sets default in preferences
   - Option B: Agent asks every time if ambiguous
   - Option C: Context-aware (last used venue)

4. **Should there be cross-venue analytics?**
   - Aggregate prep data across venues?
   - Compare efficiency metrics?
   - Centralized reporting dashboard?

---

## Next Steps

1. **Review this analysis** with stakeholders
2. **Answer questions above**
3. **Choose architecture option** (recommend Option A)
4. **Create detailed implementation plan**
5. **Migrate in phases** (start with Next.js consolidation)

---

**Prepared by:** Claude Code + Agent-Native Architecture Skill
**Review Status:** Awaiting approval to proceed with Phase 1
