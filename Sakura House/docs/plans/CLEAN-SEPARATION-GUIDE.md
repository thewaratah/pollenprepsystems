# Clean Separation Guide: Multi-Venue Backend Architecture

**Principle:** Two venues with NO shared scripts/functions, but SHARED agents/skills

---

## The Clean Separation Rules

### 🔴 NEVER SHARE
1. **Google Apps Scripts** - Each venue has completely independent GAS deployment
2. **Airtable Automations** - Separate automation webhooks per venue
3. **Script Properties** - No mixing of credentials or config
4. **Runtime State** - No shared execution context

### ✅ ALWAYS SHARE
1. **Agent Definitions** (.claude/agents/)
2. **Skills** (.claude/skills/)
3. **Documentation** (docs/)
4. **Reference Materials** (reference/)

### 🎯 CONDITIONALLY SHARE
1. **Next.js App** - Share code, separate deployments
2. **Airtable Client Library** - Share interface, venue-selected base
3. **RAG System** - Share search logic, separate tables

---

## Recommended File Structure

```
PREP SYSTEM/
│
├── venues/                           # VENUE-SPECIFIC (ISOLATED)
│   ├── sakura/
│   │   ├── gas-scripts/              # Sakura's Google Apps Scripts
│   │   │   ├── .clasp.json           # → Script ID: 1AXXXXXXXXXXXXX
│   │   │   ├── main.gs               # Sakura-specific main
│   │   │   ├── ClearWeeklyCount.gs
│   │   │   ├── FinaliseCount.gs
│   │   │   ├── GeneratePrepRun.gs
│   │   │   ├── GoogleDocsPrepSystem.gs
│   │   │   ├── FeedbackForm.gs
│   │   │   ├── RecipeScaler.gs
│   │   │   └── appsscript.json
│   │   ├── config/
│   │   │   └── script-properties.json  # Sakura Script Properties
│   │   ├── templates/                  # Sakura Google Docs templates
│   │   │   ├── ordering-list.docx
│   │   │   └── batching-list.docx
│   │   └── README.md
│   │
│   └── waratah/
│       ├── gas-scripts/              # Waratah's Google Apps Scripts
│       │   ├── .clasp.json           # → Script ID: 1BXXXXXXXXXXXXX
│       │   ├── main.gs               # Waratah-specific main
│       │   ├── ClearWeeklyCount.gs   # COPY (not import)
│       │   ├── FinaliseCount.gs      # COPY (not import)
│       │   ├── GeneratePrepRun.gs    # COPY (not import)
│       │   ├── GoogleDocsPrepSystem.gs
│       │   ├── FeedbackForm.gs
│       │   ├── RecipeScaler.gs
│       │   └── appsscript.json
│       ├── config/
│       │   └── script-properties.json  # Waratah Script Properties
│       ├── templates/
│       │   ├── ordering-list.docx
│       │   └── batching-list.docx
│       └── README.md
│
├── apps/                             # SHARED CODE (Separate Deployments)
│   └── prep-knowledge-platform/      # Next.js app
│       ├── src/
│       │   ├── lib/
│       │   │   ├── venues.ts         # Venue registry
│       │   │   ├── airtable.ts       # Generic Airtable client
│       │   │   └── api-venue.ts      # Request context resolution
│       │   └── app/api/              # Venue-aware APIs
│       ├── .env.sakura               # Sakura deployment config
│       ├── .env.waratah              # Waratah deployment config
│       └── package.json
│
├── .claude/                          # SHARED (All Venues)
│   ├── agents/prep-system/           # 13 specialized agents
│   └── skills/                       # All skills
│
├── docs/                             # SHARED
│   └── solutions/                    # Applies to all venues
│
└── reference/                        # SHARED
    └── integrations/                 # MCP servers, SDKs

```

---

## Why NOT Share Google Apps Scripts?

### Problem with Sharing
```javascript
// ❌ BAD: Shared script serving multiple venues
function doPost(e) {
  const baseId = PropertiesService.getScriptProperties().getProperty('AIRTABLE_BASE_ID');
  // Which base? Sakura or Waratah? How to choose?
  // Runtime switching = complexity + bugs
}
```

### Solution: Complete Isolation
```javascript
// ✅ GOOD: Sakura script (venues/sakura/gas-scripts/main.gs)
function doPost(e) {
  const baseId = 'appNsFRhuU47e9qlR';  // Hardcoded Sakura base
  const slackWebhook = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_PREP');
  // Always Sakura, no ambiguity
}

// ✅ GOOD: Waratah script (venues/waratah/gas-scripts/main.gs)
function doPost(e) {
  const baseId = 'wspB1DzuXWuxEAhCD';  // Hardcoded Waratah base
  const slackWebhook = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_PREP');
  // Always Waratah, no ambiguity
}
```

**Benefits:**
- ✅ Zero risk of cross-venue data corruption
- ✅ Independent deployment schedules
- ✅ Clear ownership and responsibility
- ✅ Easier debugging (no "which venue?" questions)
- ✅ Simpler Script Properties (no prefixing needed)

**Tradeoff:**
- ⚠️ Code duplication across venues
- ⚠️ Bug fixes need to be applied to both

**Mitigation:**
- 📋 Document known issues in docs/solutions/
- 🤖 Use agents to apply fixes across venues
- 📝 Maintain changelog of cross-venue updates

---

## How Next.js App Stays Shared

The Next.js app CAN be shared because it's **request-scoped**, not deployment-scoped.

### Request-Scoped Venue Selection
```typescript
// ✅ GOOD: Venue determined at request time
export async function GET(request: NextRequest) {
  const venue = getVenueFromRequest(request);
  // venue = sakura or waratah based on:
  // 1. x-venue-id header
  // 2. venueId query param
  // 3. NEXT_PUBLIC_VENUE_ID env var

  const baseId = venue.airtableBaseId;
  const data = await getStocktakeStatus(baseId);
  return Response.json(data);
}
```

### Separate Deployments
```bash
# Deploy Sakura
vercel --prod --env-file=.env.sakura
# → https://sakura-prep.vercel.app
# NEXT_PUBLIC_VENUE_ID=sakura

# Deploy Waratah
vercel --prod --env-file=.env.waratah
# → https://waratah-prep.vercel.app
# NEXT_PUBLIC_VENUE_ID=waratah
```

**Each deployment:**
- Same code
- Different environment variables
- Different default venue
- Different Vercel project

---

## Deployment Process

### Google Apps Scripts (Isolated)

#### Deploy Sakura GAS
```bash
cd venues/sakura/gas-scripts

# First time: Create project
clasp create --type standalone --title "PREP System - Sakura House"
# → Creates .clasp.json with script ID

# Every update:
clasp push
clasp deploy --description "v1.2.3"
```

#### Deploy Waratah GAS
```bash
cd venues/waratah/gas-scripts

# First time: Create project
clasp create --type standalone --title "PREP System - The Waratah"
# → Creates .clasp.json with different script ID

# Every update:
clasp push
clasp deploy --description "v1.2.3"
```

#### Script Properties Configuration

**Sakura (via Apps Script UI):**
```
AIRTABLE_BASE_ID = appNsFRhuU47e9qlR
AIRTABLE_PAT = pat...
DOCS_FOLDER_ID = <sakura-folder-id>
SLACK_WEBHOOK_GOOCH = <sakura-gooch-webhook>
SLACK_WEBHOOK_SABS = <sakura-sabs-webhook>
SLACK_WEBHOOK_PREP = <sakura-prep-webhook>
SLACK_WEBHOOK_TEST = <sakura-test-webhook>
FEEDBACK_FORM_URL = <sakura-gas-webapp-url>?page=feedback
RECIPE_SCALER_URL = <sakura-gas-webapp-url>?page=scaler
```

**Waratah (via Apps Script UI):**
```
AIRTABLE_BASE_ID = wspB1DzuXWuxEAhCD
AIRTABLE_PAT = pat...  (same PAT, different base)
DOCS_FOLDER_ID = <waratah-folder-id>
SLACK_WEBHOOK_GOOCH = <waratah-gooch-webhook>
SLACK_WEBHOOK_SABS = <waratah-sabs-webhook>
SLACK_WEBHOOK_PREP = <waratah-prep-webhook>
SLACK_WEBHOOK_TEST = <waratah-test-webhook>
FEEDBACK_FORM_URL = <waratah-gas-webapp-url>?page=feedback
RECIPE_SCALER_URL = <waratah-gas-webapp-url>?page=scaler
```

### Next.js App (Shared Code, Separate Deployments)

#### Deploy Sakura Next.js
```bash
cd apps/prep-knowledge-platform

# Create Vercel project (first time)
vercel --prod --env-file=.env.sakura --name sakura-prep
# → https://sakura-prep.vercel.app

# Subsequent deployments
vercel --prod --env-file=.env.sakura
```

#### Deploy Waratah Next.js
```bash
cd apps/prep-knowledge-platform

# Create Vercel project (first time)
vercel --prod --env-file=.env.waratah --name waratah-prep
# → https://waratah-prep.vercel.app

# Subsequent deployments
vercel --prod --env-file=.env.waratah
```

---

## How Agents/Skills Work Across Venues

### Agent System Prompt (Venue-Aware)

```markdown
# PREP SUPER AGENT

You are the intelligent operations hub for a multi-venue prep system.

## Available Venues
- **Sakura House** (`sakura`) - Japanese restaurant, Base: appNsFRhuU47e9qlR
- **The Waratah** (`waratah`) - Australian venue, Base: wspB1DzuXWuxEAhCD

## Current Context
{venue_context}

Default venue: {default_venue}

## Venue Selection
- Unless specified, use the default venue from context
- Users can specify venue by name: "What's Waratah's stocktake status?"
- For cross-venue queries, access both bases and compare

## Your Tools
All tools accept an optional `venueId` parameter:
- get_stocktake_status(venueId?)
- lookup_recipe(venueId?, recipeId)
- generate_prep_run(venueId?)
- export_prep_docs(venueId?, mode)

## Knowledge Base
- Each venue has its own RAG tables: {venueId}_rag_chunks
- Search the appropriate venue's knowledge for context
```

### Example Agent Interactions

**Single Venue Query:**
```
User: "What's the stocktake status?"

Agent: [Checks context → default venue = sakura]
       [Calls get_stocktake_status(venueId='sakura')]

Agent: "Sakura House stocktake is 85% complete. 127/150 items counted."
```

**Explicit Venue Query:**
```
User: "What's the stocktake status for Waratah?"

Agent: [Detects venue mention → waratah]
       [Calls get_stocktake_status(venueId='waratah')]

Agent: "The Waratah stocktake is 92% complete. 138/150 items counted."
```

**Cross-Venue Query:**
```
User: "Which venue uses more Wasabi Mayo per week?"

Agent: [Detects comparison → needs both venues]
       [Calls get_prep_tasks(venueId='sakura')]
       [Calls get_prep_tasks(venueId='waratah')]
       [Aggregates and compares]

Agent: "Based on recent prep runs:
        • Sakura House: 24 batches/week (avg)
        • The Waratah: 18 batches/week (avg)
        Sakura uses 33% more Wasabi Mayo."
```

### Skills Work Identically

**Example: /debugging skill**

```markdown
# Debugging Skill

When debugging PREP SYSTEM issues:
1. Identify the venue affected
2. Check that venue's Airtable base
3. Review that venue's GAS execution logs
4. Test with that venue's credentials

The debugging process is the same, but the data sources differ.
```

**Usage:**
```
User: "The Waratah prep run generation is failing"

Agent: [Uses /debugging skill]
       [Automatically scopes to Waratah context]
       [Checks wspB1DzuXWuxEAhCD base]
       [Reviews Waratah GAS logs]
```

**No venue-specific debugging skills needed!**

---

## Migration Steps (Practical)

### Step 1: Prepare Venue Folders

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Create structure
mkdir -p venues/sakura/gas-scripts
mkdir -p venues/sakura/config
mkdir -p venues/sakura/templates

mkdir -p venues/waratah/gas-scripts
mkdir -p venues/waratah/config
mkdir -p venues/waratah/templates

# Move existing scripts to Sakura
cp scripts/*.gs venues/sakura/gas-scripts/
cp scripts/*.html venues/sakura/gas-scripts/
cp scripts/.clasp.json venues/sakura/gas-scripts/
cp scripts/appsscript.json venues/sakura/gas-scripts/

# Copy scripts to Waratah
cp -r venues/sakura/gas-scripts/* venues/waratah/gas-scripts/

# Move templates
cp templates/* venues/sakura/templates/
cp templates/* venues/waratah/templates/
```

### Step 2: Create Waratah GAS Project

```bash
cd venues/waratah/gas-scripts

# Remove Sakura's clasp config
rm .clasp.json

# Create new Waratah project
clasp login
clasp create --type standalone --title "PREP System - The Waratah"

# This creates a new .clasp.json with Waratah's script ID
```

### Step 3: Configure Script Properties

**For Sakura:**
1. Open Sakura GAS project in browser: `cd venues/sakura/gas-scripts && clasp open`
2. Go to Project Settings → Script Properties
3. Add all Sakura-specific properties (from config/GoogleDocsPrepSystemScriptProperties)

**For Waratah:**
1. Open Waratah GAS project: `cd venues/waratah/gas-scripts && clasp open`
2. Go to Project Settings → Script Properties
3. Add all Waratah-specific properties

### Step 4: Deploy Both GAS Projects

```bash
# Deploy Sakura
cd venues/sakura/gas-scripts
clasp push
clasp deploy --description "Initial Sakura deployment"

# Deploy Waratah
cd venues/waratah/gas-scripts
clasp push
clasp deploy --description "Initial Waratah deployment"
```

### Step 5: Update Airtable Automation Webhooks

**Sakura Automations:**
- Update automation webhooks to point to Sakura GAS webapp URL

**Waratah Automations:**
- Update automation webhooks to point to Waratah GAS webapp URL

### Step 6: Consolidate Next.js App

```bash
# Create apps folder
mkdir -p apps

# Move prep-knowledge-platform
mv prep-knowledge-platform apps/

# Create venue-specific env files
cd apps/prep-knowledge-platform
mv .env.local .env.sakura

# Copy Waratah env
cp "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM/THE WARATAH/prep-knowledge-platform/.env" .env.waratah
```

### Step 7: Deploy Both Next.js Apps

```bash
cd apps/prep-knowledge-platform

# Deploy Sakura
vercel --prod --env-file=.env.sakura --name sakura-prep

# Deploy Waratah
vercel --prod --env-file=.env.waratah --name waratah-prep
```

### Step 8: Test Everything

**Sakura Tests:**
- [ ] Visit https://sakura-prep.vercel.app
- [ ] Test stocktake workflow
- [ ] Test prep run generation
- [ ] Test GAS export (check Sakura Slack channels)

**Waratah Tests:**
- [ ] Visit https://waratah-prep.vercel.app
- [ ] Test stocktake workflow
- [ ] Test prep run generation
- [ ] Test GAS export (check Waratah Slack channels)

**Agent Tests:**
- [ ] Chat: "What's the stocktake status?" (default venue)
- [ ] Chat: "What's Waratah's stocktake status?" (explicit venue)
- [ ] Chat: "Compare prep tasks between venues" (cross-venue)

### Step 9: Clean Up Old Structure

```bash
# Delete old scripts folder (now in venues/)
rm -rf scripts/

# Delete old templates folder (now in venues/)
rm -rf templates/

# Delete Waratah duplicate folder
rm -rf "THE WARATAH/"
```

---

## Maintenance Workflows

### Apply Bug Fix to Both Venues

**Scenario:** Found a bug in FinaliseCount.gs

```bash
# Fix in Sakura first
cd venues/sakura/gas-scripts
# Edit FinaliseCount.gs
clasp push
# Test in Sakura

# Once verified, copy to Waratah
cp FinaliseCount.gs ../../waratah/gas-scripts/
cd ../../waratah/gas-scripts
clasp push
# Test in Waratah
```

**Better (with Agent):**
```
User: "I fixed a bug in FinaliseCount.gs for Sakura. Apply the same fix to Waratah."

Agent: [Reads venues/sakura/gas-scripts/FinaliseCount.gs]
       [Identifies the change]
       [Applies to venues/waratah/gas-scripts/FinaliseCount.gs]
       [Deploys via clasp]
       "Fix applied to Waratah. Deployed as version 1.2.4."
```

### Add New Feature

**Scenario:** Add new export mode

```bash
# Implement in Sakura
cd venues/sakura/gas-scripts
# Edit GoogleDocsPrepSystem.gs
clasp push
# Test thoroughly

# Copy to Waratah
cp GoogleDocsPrepSystem.gs ../../waratah/gas-scripts/
cd ../../waratah/gas-scripts
clasp push
```

### Document Solved Problem

Uses `/compound-docs` skill (SHARED):

```
User: "That Waratah stocktake finalization bug is fixed."

Agent: [Triggers compound-docs]
       [Creates docs/solutions/waratah-issues/stocktake-finalization.md]
       [Tags: waratah, stocktake, finalization]
       [Solution: <documented>]

       "Would you like me to check if Sakura has the same issue?"
```

**The solution doc is shared** - if Sakura encounters the same bug, the agent can reference the Waratah solution.

---

## Benefits of This Architecture

### Clear Boundaries
- ✅ No ambiguity about what's shared vs isolated
- ✅ No "which venue?" runtime questions
- ✅ Obvious where to make changes

### Safe Operations
- ✅ Zero risk of cross-venue data corruption
- ✅ Independent deployments don't affect each other
- ✅ Rollback one venue without affecting the other

### Agent Intelligence Preserved
- ✅ Agents understand both venues
- ✅ Cross-venue analysis possible
- ✅ Skills work identically for both
- ✅ Knowledge compounds across venues

### Scalable
- ✅ Add Venue 3 by copying venue folder
- ✅ Process is documented and repeatable
- ✅ No architectural changes needed

---

## When to Reconsider

If you reach **5+ venues**, consider:

1. **Automated deployment pipeline**
   - Template-based GAS generation
   - Automated Script Properties setup
   - CI/CD for multi-venue deploys

2. **Shared GAS library**
   - Google Apps Script libraries (not shared execution)
   - Versioned library releases
   - Each venue imports library, has own deployment

3. **Centralized management API**
   - Admin API to manage all venues
   - Automated health checks
   - Centralized analytics dashboard

**But for 2-3 venues:** The proposed architecture is optimal.

---

## Summary

| Component | Architecture | Why |
|-----------|--------------|-----|
| Google Apps Scripts | **Isolated** | No shared runtime, clear ownership |
| Next.js App | **Shared Code** | Request-scoped, separate deployments |
| Airtable Integration | **Shared Code** | Generic client, venue parameter |
| Agents | **Shared** | Same intelligence, venue-aware |
| Skills | **Shared** | Same workflows, venue-agnostic |
| Documentation | **Shared** | Knowledge compounds |

**Key Insight:** Isolate what has **runtime state**, share what has **logic**.

- Runtime state = GAS execution context → ISOLATE
- Logic = Agent reasoning, skill workflows → SHARE

---

**Next:** Review this guide, approve architecture, proceed with migration.
