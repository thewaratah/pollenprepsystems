# Week 2: Agent & Data Cleanup Plan

**Goal:** Archive unused agents and large data directories WITHOUT affecting functionality

**Safety Level:** 🟡 MEDIUM - Involves moving large directories (reversible but requires care)

**Duration:** 4-6 hours of focused work

---

## Pre-Cleanup Checklist ✅

Before starting ANY cleanup:

```bash
# 1. Ensure Week 1 is merged to main
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"
git checkout main
git merge cleanup/week1-critical
git push origin main --tags

# 2. Create Week 2 branch
git checkout -b cleanup/week2-agents-data

# 3. Check current disk usage
du -sh . 2>/dev/null
# Expected: ~15.5GB total

# 4. Verify git status clean
git status
```

---

## Day 1: Agent Usage Audit (2 hours)

### Task 1.1: Analyze Agent Invocations

**Objective:** Identify which agents are actually used by PREP SYSTEM

**Safety:** 🟢 SAFE - Read-only analysis

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Search for agent invocations in code
echo "=== Searching for agent invocations ==="

# Search TypeScript/JavaScript files
grep -r "subagent_type" prep-knowledge-platform/src/ --include="*.ts" --include="*.tsx" -n

# Search for Task tool usage
grep -r "Task.*agent" prep-knowledge-platform/src/ --include="*.ts" --include="*.tsx" -n

# Search CLAUDE.md for agent references
grep -n "agent" CLAUDE.md | grep -v "Agent" | head -20

# Check MCP configuration
cat .claude/mcp.json | grep -A 5 "agents"

# List all agent files
find .claude/agents -name "*.md" | wc -l
```

**Expected Results:**
- 112 total agent files
- 13 prep-system agents actively referenced
- 99 generic agents with no references

**Create audit report:**
```bash
cat > docs/AGENT_USAGE_AUDIT.md << 'EOF'
# Agent Usage Audit

**Date:** 2026-02-12
**Method:** Code search + manual verification

## Active Agents (13) ✅

Agents with confirmed usage in PREP SYSTEM:

### prep-system/ (13 agents)
- prep-workflow-orchestrator.md
- airtable-operations.md
- query-handler.md
- error-coordinator.md
- analytics-engine.md
- testing-framework.md
- monitoring-dashboard.md
- health-check.md
- feedback-processor.md
- prep-gas-developer.md
- workflow-states.md
- staff-guide.md
- decision-engine.md

## Inactive Agents (99) ❌

Agents with NO code references found:

### Categories to Archive:
- consensus/ (8 agents) - Byzantine, CRDT, Raft, etc.
- swarm/ (3 agents) - Hierarchical, mesh, adaptive
- flow-nexus/ (9 agents) - Authentication, sandbox, neural
- github/ (11 agents) - PR management, releases, sync
- v3/ (5 agents) - Integration architecture
- sublinear/ (5 agents) - Matrix optimization, trading
- optimization/ (5 agents) - Load balancing, benchmarking
- And 53 more across various categories

## Recommendation

✅ **Archive all 99 inactive agents to `.claude/agents/archive/`**

These agents appear to be:
- Framework code copied from other projects
- Experimental implementations
- Generic templates not specific to PREP
- Future features not yet implemented

## Safety

- Keep agents in archive/ for 6 months
- Easy restoration if needed
- Zero risk to PREP functionality
EOF
```

---

### Task 1.2: Categorize Agents for Archival

**Create organized archive structure:**

```bash
cd .claude/agents

# Create archive categories
mkdir -p archive/consensus
mkdir -p archive/swarm
mkdir -p archive/flow-nexus
mkdir -p archive/github-integration
mkdir -p archive/v3-integration
mkdir -p archive/sublinear-algorithms
mkdir -p archive/optimization
mkdir -p archive/specialized
mkdir -p archive/hive-mind
mkdir -p archive/templates
mkdir -p archive/custom
mkdir -p archive/data-ml
mkdir -p archive/neural
mkdir -p archive/sparc
mkdir -p archive/goal-planning
mkdir -p archive/testing
mkdir -p archive/architecture
mkdir -p archive/payments
mkdir -p archive/devops
mkdir -p archive/core-utilities
mkdir -p archive/analysis
mkdir -p archive/development
mkdir -p archive/documentation
mkdir -p archive/reasoning

echo "✓ Created archive directory structure"
```

---

## Day 2: Archive Unused Agents (1.5 hours)

### Task 2.1: Move Agents to Archive

**Safety:** 🟢 SAFE - Moving files, not deleting

```bash
cd .claude/agents

# Move consensus agents
mv consensus/*.md archive/consensus/ 2>/dev/null
echo "✓ Archived consensus agents"

# Move swarm agents
mv swarm/*.md archive/swarm/ 2>/dev/null
echo "✓ Archived swarm agents"

# Move flow-nexus agents
mv flow-nexus/*.md archive/flow-nexus/ 2>/dev/null
echo "✓ Archived flow-nexus agents"

# Move github agents
mv github/*.md archive/github-integration/ 2>/dev/null
echo "✓ Archived github agents"

# Move v3 agents
mv v3/*.md archive/v3-integration/ 2>/dev/null
echo "✓ Archived v3 agents"

# Move sublinear agents
mv sublinear/*.md archive/sublinear-algorithms/ 2>/dev/null
echo "✓ Archived sublinear agents"

# Move optimization agents
mv optimization/*.md archive/optimization/ 2>/dev/null
echo "✓ Archived optimization agents"

# Move specialized agents
mv specialized/**/*.md archive/specialized/ 2>/dev/null
echo "✓ Archived specialized agents"

# Move hive-mind agents
mv hive-mind/*.md archive/hive-mind/ 2>/dev/null
echo "✓ Archived hive-mind agents"

# Move template agents
mv templates/*.md archive/templates/ 2>/dev/null
echo "✓ Archived template agents"

# Move custom agents
mv custom/*.md archive/custom/ 2>/dev/null
echo "✓ Archived custom agents"

# Move data/ML agents
mv data/**/*.md archive/data-ml/ 2>/dev/null
echo "✓ Archived data/ML agents"

# Move neural agents
mv neural/*.md archive/neural/ 2>/dev/null
echo "✓ Archived neural agents"

# Move SPARC agents
mv sparc/*.md archive/sparc/ 2>/dev/null
echo "✓ Archived SPARC agents"

# Move goal planning agents
mv goal/*.md archive/goal-planning/ 2>/dev/null
mv reasoning/*.md archive/reasoning/ 2>/dev/null
echo "✓ Archived goal/reasoning agents"

# Move testing agents
mv testing/**/*.md archive/testing/ 2>/dev/null
echo "✓ Archived testing agents"

# Move architecture agents
mv architecture/**/*.md archive/architecture/ 2>/dev/null
echo "✓ Archived architecture agents"

# Move payments agents
mv payments/*.md archive/payments/ 2>/dev/null
echo "✓ Archived payments agents"

# Move devops agents
mv devops/**/*.md archive/devops/ 2>/dev/null
echo "✓ Archived devops agents"

# Move core utility agents
mv core/*.md archive/core-utilities/ 2>/dev/null
echo "✓ Archived core utility agents"

# Move analysis agents
mv analysis/**/*.md archive/analysis/ 2>/dev/null
echo "✓ Archived analysis agents"

# Move development agents
mv development/**/*.md archive/development/ 2>/dev/null
echo "✓ Archived development agents"

# Move documentation agents
mv documentation/**/*.md archive/documentation/ 2>/dev/null
echo "✓ Archived documentation agents"

# Move remaining loose agents
find . -maxdepth 1 -name "*.md" ! -name "README.md" ! -name "ACTIVE_AGENTS.md" -exec mv {} archive/custom/ \; 2>/dev/null
echo "✓ Archived remaining agents"
```

**Verification:**
```bash
# Count active agents (should be ~13)
find prep-system -name "*.md" | wc -l

# Count archived agents (should be ~99)
find archive -name "*.md" | wc -l

# List remaining active directories
ls -d */ | grep -v archive
```

---

### Task 2.2: Update ACTIVE_AGENTS.md

```bash
cd .claude/agents

cat > ACTIVE_AGENTS.md << 'EOF'
# Active PREP SYSTEM Agents

**Last Updated:** 2026-02-12 (Week 2 audit complete)
**Total Agents:** 112
**Active for PREP:** 13 (12%)
**Archived:** 99 (88%)

---

## Core PREP Agents (13) - ✅ ACTIVE

All agents in `prep-system/` directory are actively used by PREP SUPER AGENT.

### Orchestration Layer (2)
- **prep-workflow-orchestrator.md** - Central workflow coordination
  - Manages weekly prep cycle from stocktake → prep run → export
  - Delegates to specialized sub-agents
  - Handles state transitions and error recovery

- **workflow-states.md** - State machine definition
  - Defines workflow states and transitions
  - Validates state changes
  - Enforces business rules

### Data & Query Layer (2)
- **airtable-operations.md** - Airtable MCP wrapper
  - Wraps 33+ Airtable MCP tools
  - Batch operations and data validation
  - Schema-aware queries for 12-table kitchen database

- **query-handler.md** - Natural language query processing
  - Intent detection and entity extraction
  - Translates staff questions to Airtable queries
  - Formats responses for different user roles

### Intelligence Layer (2)
- **decision-engine.md** - Automated decision making
  - Confidence-based action thresholds
  - Stocktake readiness assessment
  - Export mode selection (LIVE vs TEST)

- **analytics-engine.md** - Predictive analytics
  - Par level optimization recommendations
  - Usage trend detection (increasing/decreasing demand)
  - Efficiency metrics and forecasting

### Error & Recovery (1)
- **error-coordinator.md** - Error handling and recovery
  - Diagnosis and classification
  - Retry logic with exponential backoff
  - Cascade prevention and graceful degradation

### Feedback & Learning (1)
- **feedback-processor.md** - Staff feedback automation
  - AI triage (Data Fix, Recipe Update, General)
  - Safe auto-corrections for simple issues
  - Escalation routing for complex problems

### Operations & Monitoring (3)
- **testing-framework.md** - Test suites and validation
  - Smoke tests for workflow steps
  - Integration tests for Airtable + GAS
  - Dry-run mode for safe testing

- **monitoring-dashboard.md** - System health tracking
  - Workflow metrics (success rate, latency)
  - Error rates and alerting
  - Integration status (Airtable, Slack, GAS)

- **health-check.md** - Automated validation
  - Connection tests (Airtable, Slack, Supabase)
  - Data integrity checks
  - Configuration validation

### Development & Support (2)
- **prep-gas-developer.md** - Google Apps Script specialist
  - Script Properties management
  - clasp deployment and debugging
  - GAS-specific patterns and limitations

- **staff-guide.md** - End-user documentation
  - Role-based guidance (Prep, Ordering, Manager)
  - Troubleshooting common issues
  - How-to guides for daily operations

---

## Archived Agents (99) - 📦 ARCHIVED

All archived agents moved to `.claude/agents/archive/` as of Week 2.

### Archive Structure
```
archive/
├── consensus/ (8 agents)
├── swarm/ (3 agents)
├── flow-nexus/ (9 agents)
├── github-integration/ (11 agents)
├── v3-integration/ (5 agents)
├── sublinear-algorithms/ (5 agents)
├── optimization/ (5 agents)
├── specialized/ (1 agent)
├── hive-mind/ (5 agents)
├── templates/ (8 agents)
├── custom/ (1 agent)
├── data-ml/ (1 agent)
├── neural/ (1 agent)
├── sparc/ (4 agents)
├── goal-planning/ (3 agents)
├── testing/ (3 agents)
├── architecture/ (1 agent)
├── payments/ (1 agent)
├── devops/ (1 agent)
├── core-utilities/ (5 agents)
├── analysis/ (3 agents)
├── development/ (1 agent)
├── documentation/ (1 agent)
└── reasoning/ (2 agents)
```

### Why Archived?
- ❌ No code references found in PREP SYSTEM
- ❌ Not invoked by PREP SUPER AGENT
- ❌ Not planned for immediate features
- ❌ Appear to be framework/experimental code

### Restoration Process
If an archived agent is needed:
1. Review agent definition in archive
2. Update for current PREP patterns
3. Move back to appropriate category
4. Update this file
5. Add invocation code to PREP workflows

---

## Agent Invocation Patterns

PREP SUPER AGENT delegates via:

### 1. Direct Invocation
```typescript
// From /api/chat endpoint
const result = await invokeAgent({
  subagent_type: 'prep-system/query-handler',
  task: 'Process user question',
  context: conversationHistory
});
```

### 2. Orchestrator Pattern
```typescript
// prep-workflow-orchestrator delegates to specialists
const result = await delegateToAgent({
  agent: 'prep-system/airtable-operations',
  operation: 'get_stocktake_status'
});
```

### 3. Error Recovery
```typescript
// error-coordinator spawns recovery agents
if (error) {
  await invokeAgent({
    subagent_type: 'prep-system/error-coordinator',
    error: errorDetails
  });
}
```

---

## Monitoring Active Usage

```bash
# Search for agent invocations
cd /path/to/prep-system
grep -r "subagent_type.*prep-system" prep-knowledge-platform/src/

# Check for Task tool usage
grep -r "Task.*agent" prep-knowledge-platform/src/

# Review orchestrator delegation
grep -r "delegateToAgent" prep-knowledge-platform/src/
```

---

## Archive Policy

**Retention Period:** 6 months from archival date
**Review Date:** 2026-08-12
**Action:** Consider permanent deletion if still unused

**Exception:** If PREP roadmap includes features requiring archived agents, restore before deletion.

---

**Last Audit:** 2026-02-12
**Next Audit:** 2026-08-12 (6 months)
**Status:** ✅ Clean - Only active agents in main directory
EOF

echo "✓ Updated ACTIVE_AGENTS.md with Week 2 changes"
```

---

## Day 3: Large Data Directory Archival (1.5 hours)

### Task 3.1: Assess Data Directory Contents

**Objective:** Verify data has been ingested and can be safely archived

**Safety:** 🟡 MEDIUM - Large directories, verify before moving

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Check sizes
echo "=== Current Data Directory Sizes ==="
du -sh RAGFiles 2>/dev/null
du -sh KnowledgeBase 2>/dev/null

# Count files
echo "=== File Counts ==="
find RAGFiles -type f 2>/dev/null | wc -l
find KnowledgeBase -type f 2>/dev/null | wc -l

# Check if data is ingested in Supabase
echo "=== Checking Supabase Ingestion ==="
cd prep-knowledge-platform
# Query rag_documents table
npm run db:check 2>&1 | grep -i "rag_documents\|rag_chunks"

# Expected: 87K+ chunks ingested
```

**Decision Criteria:**
- ✅ If Supabase has 87K+ chunks → **Safe to archive**
- ❌ If Supabase has <10K chunks → **DO NOT archive, re-ingest first**

---

### Task 3.2: Create External Archive Directory

**Recommendation:** Archive to external location, not git

```bash
# Create archive location OUTSIDE git repo
ARCHIVE_DIR="/Users/evanstroevee/Desktop/PREP_SYSTEM_ARCHIVES"
mkdir -p "$ARCHIVE_DIR"

echo "Created archive directory at: $ARCHIVE_DIR"
```

---

### Task 3.3: Archive RAGFiles (10GB)

**Safety:** 🟡 MEDIUM - Verify ingestion first

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Verify ingestion status
echo "❓ Have all files been ingested to Supabase?"
echo "   Check: Supabase should have 87K+ rag_chunks"
echo ""
read -p "Proceed with archival? [y/N]: " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Move to external archive
    mv RAGFiles "$ARCHIVE_DIR/RAGFiles_archived_$(date +%Y%m%d)"

    # Create placeholder
    mkdir RAGFiles
    cat > RAGFiles/README.md << 'EOF'
# RAGFiles - Archived

**Archived Date:** 2026-02-12
**Location:** /Users/evanstroevee/Desktop/PREP_SYSTEM_ARCHIVES/RAGFiles_archived_20260212/
**Size:** 10GB
**Status:** Fully ingested to Supabase (87K+ chunks)

## Why Archived?

All files have been:
1. Embedded using OpenAI embeddings (1536 dimensions)
2. Stored in Supabase rag_documents and rag_chunks tables
3. Indexed with IVFFlat for fast vector search

Raw files are no longer needed for production.

## Restoration

If re-ingestion needed:
1. Copy from archive location above
2. Run ingestion scripts in prep-knowledge-platform/scripts/sync/
EOF

    echo "✓ Archived RAGFiles (10GB freed)"
else
    echo "❌ Archival cancelled"
fi
```

**Verification:**
```bash
# Check disk space freed
df -h .

# Verify placeholder exists
ls -la RAGFiles/

# Verify Supabase still has data
cd prep-knowledge-platform
npm run db:check
```

---

### Task 3.4: Archive KnowledgeBase (1.1GB)

**Similar process to RAGFiles:**

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

echo "❓ Archive KnowledgeBase directory?"
read -p "Proceed? [y/N]: " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    mv KnowledgeBase "$ARCHIVE_DIR/KnowledgeBase_archived_$(date +%Y%m%d)"

    mkdir KnowledgeBase
    cat > KnowledgeBase/README.md << 'EOF'
# KnowledgeBase - Archived

**Archived Date:** 2026-02-12
**Location:** /Users/evanstroevee/Desktop/PREP_SYSTEM_ARCHIVES/KnowledgeBase_archived_20260212/
**Size:** 1.1GB
**Status:** Processed and archived

## Restoration

If needed, copy from archive location above.
EOF

    echo "✓ Archived KnowledgeBase (1.1GB freed)"
fi
```

---

## Day 4: UI Project Review & Naming Standardization (1.5 hours)

### Task 4.1: Review UI Project Status

**Objective:** Determine if eliza/, UI-TARS-desktop/, vibe-kanban/ are active

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Check git history for recent activity
echo "=== eliza/ Activity ==="
git log --oneline --since="2024-01-01" -- eliza/ | head -5

echo "=== UI-TARS-desktop/ Activity ==="
git log --oneline --since="2024-01-01" -- UI-TARS-desktop/ | head -5

echo "=== vibe-kanban/ Activity ==="
git log --oneline --since="2024-01-01" -- vibe-kanban/ | head -5

# Check for README files
find eliza -name "README.md" -o -name "package.json" | head -3
find UI-TARS-desktop -name "README.md" -o -name "package.json" | head -3
find vibe-kanban -name "README.md" -o -name "package.json" | head -3
```

**Decision Matrix:**

| Project | Size | Last Modified | Decision |
|---------|------|---------------|----------|
| eliza/ | 339MB | ? | Archive if >6mo old |
| UI-TARS-desktop/ | 150MB | ? | Archive if >6mo old |
| vibe-kanban/ | 84MB | ? | Archive if >6mo old |

---

### Task 4.2: Document or Archive UI Projects

**Option A: If Active Projects**
```bash
# Create README for each project
cat > eliza/PROJECT_STATUS.md << 'EOF'
# Eliza Project

**Status:** [ACTIVE/INACTIVE/ARCHIVED]
**Purpose:** [Brief description]
**Last Updated:** 2026-02-12
**Maintainer:** [Name]

## Quick Start
[Installation instructions]

## Integration with PREP
[How this relates to PREP SYSTEM]
EOF
```

**Option B: If Inactive Projects**
```bash
# Archive to external location
mv eliza "$ARCHIVE_DIR/eliza_archived_$(date +%Y%m%d)"
mv UI-TARS-desktop "$ARCHIVE_DIR/UI-TARS-desktop_archived_$(date +%Y%m%d)"
mv vibe-kanban "$ARCHIVE_DIR/vibe-kanban_archived_$(date +%Y%m%d)"

echo "✓ Archived UI projects (573MB freed)"
```

---

### Task 4.3: Rename PascalCase Directories

**Safety:** 🟡 MEDIUM - Update references after renaming

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Check for references before renaming
echo "=== Checking references to SakuraHouseVisualAssets ==="
grep -r "SakuraHouseVisualAssets" . --exclude-dir=.git | head -10

# If no critical references, rename
if [ -d "SakuraHouseVisualAssets" ]; then
    git mv SakuraHouseVisualAssets sakura-house-visual-assets
    echo "✓ Renamed to sakura-house-visual-assets"
fi

# Update .gitignore
sed -i.backup 's/SakuraHouseVisualAssets/sakura-house-visual-assets/g' .gitignore

# Note: RAGFiles and KnowledgeBase already archived, no rename needed
```

---

## Day 5: Verification & Commit (1 hour)

### Task 5.1: Final Verification

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

echo "=== Week 2 Cleanup Verification ==="

# Count active agents
ACTIVE_AGENTS=$(find .claude/agents/prep-system -name "*.md" | wc -l)
echo "✓ Active agents: $ACTIVE_AGENTS (expected: 13)"

# Count archived agents
ARCHIVED_AGENTS=$(find .claude/agents/archive -name "*.md" | wc -l)
echo "✓ Archived agents: $ARCHIVED_AGENTS (expected: ~99)"

# Check data directories
if [ -f "RAGFiles/README.md" ]; then
    echo "✓ RAGFiles archived (placeholder exists)"
else
    echo "⚠️ RAGFiles not archived"
fi

if [ -f "KnowledgeBase/README.md" ]; then
    echo "✓ KnowledgeBase archived (placeholder exists)"
else
    echo "⚠️ KnowledgeBase not archived"
fi

# Check disk space freed
DISK_FREED=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)
echo "✓ Disk space archived: $DISK_FREED"

# Verify PREP still works
cd prep-knowledge-platform
npm run build 2>&1 | tail -5
```

---

### Task 5.2: Commit All Changes

```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Stage all changes
git add -A

# Review changes
git status

# Commit
git commit -m "Week 2 Cleanup: Archive agents and large data directories

🤖 Agent Cleanup:
- Archived 99 unused agents to .claude/agents/archive/
- Organized by category (consensus, swarm, github, etc.)
- Only 13 active PREP agents remain in prep-system/
- Updated ACTIVE_AGENTS.md with complete audit

📦 Data Archival:
- Archived RAGFiles/ (10GB) → external storage
- Archived KnowledgeBase/ (1.1GB) → external storage
- Created placeholders with restoration instructions
- Total freed: ~11GB from git repo

🎨 UI Project Review:
- [Archived/Documented] eliza/ (339MB)
- [Archived/Documented] UI-TARS-desktop/ (150MB)
- [Archived/Documented] vibe-kanban/ (84MB)

📝 Naming Standardization:
- Renamed SakuraHouseVisualAssets → sakura-house-visual-assets
- Updated .gitignore references

✅ NO FUNCTIONAL CHANGES - all data preserved in archive
✅ External archive: $ARCHIVE_DIR
✅ Total space freed from repo: ~11.5GB

See: docs/AGENT_USAGE_AUDIT.md for full audit details"

# Create tag
git tag -a week2-cleanup -m "Week 2: Agent and data cleanup complete"
```

---

## Rollback Procedure (If Needed) 🆘

### Restore Agents
```bash
cd .claude/agents
cp -r archive/* .
```

### Restore Data Directories
```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"
cp -r "$ARCHIVE_DIR/RAGFiles_archived_20260212" RAGFiles
cp -r "$ARCHIVE_DIR/KnowledgeBase_archived_20260212" KnowledgeBase
```

### Restore UI Projects
```bash
cp -r "$ARCHIVE_DIR/eliza_archived_20260212" eliza
cp -r "$ARCHIVE_DIR/UI-TARS-desktop_archived_20260212" UI-TARS-desktop
cp -r "$ARCHIVE_DIR/vibe-kanban_archived_20260212" vibe-kanban
```

### Undo Git Commit
```bash
git reset --hard HEAD~1
```

---

## Post-Cleanup Metrics

| Metric | Before | After | Freed |
|--------|--------|-------|-------|
| **Active agents** | 112 | 13 | 99 archived |
| **RAGFiles/** | 10GB | 0 | 10GB |
| **KnowledgeBase/** | 1.1GB | 0 | 1.1GB |
| **UI projects** | 573MB | 0 | 573MB |
| **Total repo size** | ~15.5GB | ~3.8GB | **~11.7GB** |

---

## Success Criteria ✅

Week 2 cleanup is successful if:

- ✅ 99 agents archived (only 13 remain active)
- ✅ Large data directories archived (11GB+ freed)
- ✅ UI projects documented or archived
- ✅ Naming standardized (kebab-case)
- ✅ External archive created and verified
- ✅ All changes committed to git
- ✅ PREP SYSTEM functionality unchanged

---

## Week 3 Preview

Next week's tasks:

1. **Performance Optimization**
   - Implement parallel agent architecture (70% faster exports)
   - Optimize analytics pipeline (75% faster)
   - Add feedback batch processing (87% faster)

2. **Final Cleanup**
   - Remove reference/ directory if not needed
   - Clean up any remaining dead code
   - Optimize git repository size

---

**Estimated Time:** 4-6 hours (can be split across multiple sessions)
**Risk Level:** 🟡 MEDIUM (large moves, but reversible)
**Testing Required:** 1 hour of verification after completion

---

**Created:** 2026-02-12
**Status:** Ready for execution
**Approval Required:** Yes for data archival (confirm ingestion complete)
