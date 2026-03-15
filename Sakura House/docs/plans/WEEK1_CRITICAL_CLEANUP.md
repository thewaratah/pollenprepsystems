# Week 1: Critical Cleanup Plan

**Goal:** Clean up dead files and organize structure WITHOUT affecting functionality

**Safety Level:** 🟢 SAFE - All actions are reversible and non-breaking

**Duration:** 3-5 hours of focused work

---

## Pre-Cleanup Checklist ✅

Before starting ANY cleanup:

```bash
# 1. Create backup
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"
tar -czf "../PREP_SYSTEM_BACKUP_$(date +%Y%m%d_%H%M%S).tar.gz" \
  --exclude="node_modules" \
  --exclude="reference" \
  --exclude="RAGFiles" \
  --exclude="KnowledgeBase" \
  --exclude=".git" \
  .

# 2. Verify backup created
ls -lh ../PREP_SYSTEM_BACKUP_*.tar.gz

# 3. Check git status (ensure clean state)
git status

# 4. Create cleanup branch
git checkout -b cleanup/week1-critical
```

**Expected Backup Size:** ~100-200MB (excluding large data directories)

---

## Day 1: prep-knowledge-platform Root Cleanup (2 hours)

### Task 1.1: Archive Dead Migration Files

**Safety:** 🟢 SAFE - These files are superseded by `supabase/migrations/`

**Files to Archive (13):**
- ✅ Production migrations are in `supabase/migrations/`
- ✅ These root files are debugging artifacts

```bash
cd prep-knowledge-platform

# Create archive directory
mkdir -p archive/old-migrations

# Move all dead migration files
mv EXACT-DROP.sql archive/old-migrations/
mv FORCE-DROP.sql archive/old-migrations/
mv step1-DROP.sql archive/old-migrations/
mv step2-CREATE.sql archive/old-migrations/
mv migration-MINIMAL.sql archive/old-migrations/
mv migration-COMPLETE.sql archive/old-migrations/
mv migration-CRITICAL.sql archive/old-migrations/
mv migration-FINAL.sql archive/old-migrations/
mv migration-FIX.sql archive/old-migrations/
mv migration-WITH-JOIN.sql archive/old-migrations/
mv all-migrations.sql archive/old-migrations/

# Add README explaining archive
cat > archive/old-migrations/README.md << 'EOF'
# Archived Migration Files

**Archived:** 2026-02-12
**Reason:** Superseded by production migrations in `supabase/migrations/`

These files were created during iterative development and debugging.
The canonical migrations are now:
- `supabase/migrations/001_match_documents.sql`
- `supabase/migrations/002_optimize_search.sql`
- `supabase/migrations/003_memory_tables.sql`
- `supabase/migrations/004_reasoning_bank.sql`
- `supabase/migrations/005_waratah_rag_tables.sql`

**Do not apply these archived migrations to production.**

If needed for historical reference, they are preserved here.
EOF

# Verify files moved
ls -la archive/old-migrations/
```

**Verification:**
```bash
# Ensure supabase migrations still exist
ls -la supabase/migrations/

# Expected: 5 production migration files
# 001_match_documents.sql
# 002_optimize_search.sql
# 003_memory_tables.sql
# 004_reasoning_bank.sql
# 005_waratah_rag_tables.sql
```

---

### Task 1.2: Organize Utility Scripts

**Safety:** 🟢 SAFE - Moving scripts, not deleting

**Create Organized Structure:**
```bash
cd prep-knowledge-platform

# Create organized directories
mkdir -p scripts/migrations
mkdir -p scripts/search-tests
mkdir -p scripts/sync
mkdir -p scripts/schema

# Move migration utilities
mv apply-migrations-pg.mjs scripts/migrations/
mv run-migrations.mjs scripts/migrations/

# Move search test scripts
mv search-koji.mjs scripts/search-tests/
mv search-koji-deep.mjs scripts/search-tests/
mv search-koji-text.mjs scripts/search-tests/
mv test-search.mjs scripts/search-tests/
mv test-search-raw.mjs scripts/search-tests/

# Move sync utilities
mv sync-ingredient-db.mjs scripts/sync/ 2>/dev/null || true

# Move schema utilities
mv check-schema.mjs scripts/schema/
mv check-koji-chunks.mjs scripts/schema/
mv check-koji-docs.mjs scripts/schema/

# Move debug scripts to archive
mkdir -p archive/debug-scripts
mv find-and-drop.mjs archive/debug-scripts/ 2>/dev/null || true
mv apply-migrations.js archive/debug-scripts/ 2>/dev/null || true

# Add README to each directory
cat > scripts/migrations/README.md << 'EOF'
# Migration Utilities

Scripts for applying Supabase migrations.

- `apply-migrations-pg.mjs` - PostgreSQL migration applier
- `run-migrations.mjs` - Migration runner with validation
EOF

cat > scripts/search-tests/README.md << 'EOF'
# Search Test Scripts

Ad-hoc scripts for testing RAG search functionality.

These are development/debugging tools, not production code.
EOF

cat > scripts/sync/README.md << 'EOF'
# Sync Utilities

Scripts for syncing data between Airtable and Supabase.

- `sync-ingredient-db.mjs` - Ingredient synchronization
EOF

cat > scripts/schema/README.md << 'EOF'
# Schema Validation Scripts

Scripts for validating database schema and RAG data integrity.

- `check-schema.mjs` - Database schema validator
- `check-koji-chunks.mjs` - RAG chunk integrity checker
- `check-koji-docs.mjs` - RAG document validator
EOF
```

**Verification:**
```bash
# Root should now only have config files
ls -1 prep-knowledge-platform/*.{sql,mjs,js} 2>/dev/null

# Should show:
# eslint.config.mjs (config - keep)
# postcss.config.mjs (config - keep)

# Verify organized structure
tree prep-knowledge-platform/scripts/ -L 2
tree prep-knowledge-platform/archive/ -L 2
```

---

### Task 1.3: Update package.json Scripts

**Safety:** 🟢 SAFE - Adding convenience scripts

```bash
cd prep-knowledge-platform

# Backup package.json
cp package.json package.json.backup

# Add organized script references
# (Manual edit in IDE or use node script)
```

**Add to package.json `scripts` section:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",

    "db:migrate": "node scripts/migrations/run-migrations.mjs",
    "db:check": "node scripts/schema/check-schema.mjs",

    "test:search": "node scripts/search-tests/test-search.mjs",
    "test:search:raw": "node scripts/search-tests/test-search-raw.mjs",

    "sync:ingredients": "node scripts/sync/sync-ingredient-db.mjs"
  }
}
```

**Verification:**
```bash
npm run db:check
# Should run without errors (validates scripts still work)
```

---

## Day 2: Documentation Reorganization (1.5 hours)

### Task 2.1: Rename Documentation Files

**Safety:** 🟢 SAFE - Renaming for clarity, not deleting

```bash
cd docs

# Rename Level-based docs to purpose-based
mv README-Level1-Basic.md STAFF_GUIDE.md
mv README-Level2-Intermediate.md MANAGER_GUIDE.md
mv README-Level3-DeepDive.md TECHNICAL_REFERENCE.md

# Add redirects for old names (if anyone has bookmarks)
cat > README-Level1-Basic.md << 'EOF'
# Moved

This file has been renamed to `STAFF_GUIDE.md` for clarity.

See: [STAFF_GUIDE.md](STAFF_GUIDE.md)
EOF

cat > README-Level2-Intermediate.md << 'EOF'
# Moved

This file has been renamed to `MANAGER_GUIDE.md` for clarity.

See: [MANAGER_GUIDE.md](MANAGER_GUIDE.md)
EOF

cat > README-Level3-DeepDive.md << 'EOF'
# Moved

This file has been renamed to `TECHNICAL_REFERENCE.md` for clarity.

See: [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md)
EOF
```

**Update CLAUDE.md references:**
```bash
cd ..

# Find and show references to old names
grep -n "Level1\|Level2\|Level3" CLAUDE.md

# Replace in CLAUDE.md (manual or sed)
sed -i.backup 's/README-Level1-Basic\.md/STAFF_GUIDE.md/g' CLAUDE.md
sed -i.backup 's/README-Level2-Intermediate\.md/MANAGER_GUIDE.md/g' CLAUDE.md
sed -i.backup 's/README-Level3-DeepDive\.md/TECHNICAL_REFERENCE.md/g' CLAUDE.md
```

**Verification:**
```bash
# Ensure renamed files exist
ls -la docs/STAFF_GUIDE.md
ls -la docs/MANAGER_GUIDE.md
ls -la docs/TECHNICAL_REFERENCE.md

# Check CLAUDE.md updated
grep -c "STAFF_GUIDE\|MANAGER_GUIDE\|TECHNICAL_REFERENCE" CLAUDE.md
```

---

### Task 2.2: Split Large SUPABASE_RAG_SETUP.md

**Safety:** 🟢 SAFE - Splitting content, not removing

```bash
cd docs

# Create setup directory
mkdir -p setup

# Split SUPABASE_RAG_SETUP.md into logical sections
# (This requires manual editing - identify section boundaries)

# After manual split, move to setup/
mv SUPABASE_RAG_SETUP.md setup/SUPABASE_RAG_SETUP_ORIGINAL.md

# Create index file
cat > setup/README.md << 'EOF'
# PREP SYSTEM Setup Guides

## Database Setup

1. [Initial Supabase Setup](SUPABASE_INITIAL_SETUP.md) - Project creation, environment config
2. [RAG Configuration](RAG_CONFIGURATION.md) - Vector embeddings, pgvector setup
3. [Migration Deployment](MIGRATION_DEPLOYMENT.md) - Applying schema migrations

## Original Documentation

For reference, the original combined guide: [SUPABASE_RAG_SETUP_ORIGINAL.md](SUPABASE_RAG_SETUP_ORIGINAL.md)

---

**Note:** This was split from a single 52KB file for better organization.
Each section now has focused, actionable content.
EOF
```

**Manual Step Required:**
1. Open `docs/setup/SUPABASE_RAG_SETUP_ORIGINAL.md`
2. Identify natural section breaks (look for major headers)
3. Split into 3 files:
   - `SUPABASE_INITIAL_SETUP.md` (~15KB)
   - `RAG_CONFIGURATION.md` (~20KB)
   - `MIGRATION_DEPLOYMENT.md` (~17KB)

**Verification:**
```bash
# Check file sizes
ls -lh docs/setup/*.md

# Ensure total content preserved
wc -l docs/setup/SUPABASE_RAG_SETUP_ORIGINAL.md
wc -l docs/setup/SUPABASE_INITIAL_SETUP.md
wc -l docs/setup/RAG_CONFIGURATION.md
wc -l docs/setup/MIGRATION_DEPLOYMENT.md

# Sum of split files should equal original
```

---

## Day 3: Agent Directory Cleanup (1.5 hours)

### Task 3.1: Document Active Agents

**Safety:** 🟢 SAFE - Documentation only, no file moves yet

```bash
cd .claude/agents

# Create active agents documentation
cat > ACTIVE_AGENTS.md << 'EOF'
# Active PREP SYSTEM Agents

**Last Updated:** 2026-02-12
**Total Agents:** 112
**Active for PREP:** 13 (12%)
**Status:** Under review for archival of unused agents

---

## Core PREP Agents (13) - ✅ ACTIVE

These agents are actively used by PREP SUPER AGENT:

### Orchestration Layer
- `prep-system/prep-workflow-orchestrator.md` - Central workflow coordination
- `prep-system/workflow-states.md` - State machine management

### Data & Query Layer
- `prep-system/airtable-operations.md` - Airtable MCP wrapper
- `prep-system/query-handler.md` - Natural language query processing

### Intelligence Layer
- `prep-system/decision-engine.md` - Automated decision making
- `prep-system/analytics-engine.md` - Predictive analytics

### Error & Recovery
- `prep-system/error-coordinator.md` - Error handling and recovery

### Feedback & Learning
- `prep-system/feedback-processor.md` - Staff feedback automation

### Operations & Monitoring
- `prep-system/testing-framework.md` - Test suites
- `prep-system/monitoring-dashboard.md` - System health
- `prep-system/health-check.md` - Automated validation

### Development & Support
- `prep-system/prep-gas-developer.md` - Google Apps Script specialist
- `prep-system/staff-guide.md` - End-user documentation

---

## Generic Agents (99) - ⚠️ UNDER REVIEW

These agents are NOT currently used by PREP SYSTEM.
They may be:
- Framework code for future features
- Experimental implementations
- Copy-pasted from other projects
- Generic templates

**Categories:**
- Consensus (8) - Byzantine fault tolerance, CRDT, Raft
- Swarm Coordination (3) - Hierarchical, mesh, adaptive
- Flow Nexus (9) - Authentication, sandbox, neural network
- GitHub Integration (11) - PR management, releases, sync
- V3 Integration (5) - Architecture, performance, security
- Sublinear Algorithms (5) - Matrix optimization, trading
- Performance Optimization (5) - Load balancing, benchmarking
- Others (53) - Various specialized agents

**Status:** Pending audit to determine:
1. Are any used by PREP workflows?
2. Are any planned for upcoming features?
3. Should any be archived?

**Action Items:**
- [ ] Audit agent invocation logs
- [ ] Review with team for future roadmap
- [ ] Archive unused agents to separate repo
- [ ] Keep only PREP-specific agents in this directory

---

## How to Verify Active Usage

```bash
# Search for agent invocations in logs
cd /path/to/prep-system
grep -r "Task.*subagent_type" . --include="*.ts" --include="*.tsx"

# Check MCP configuration
cat .claude/mcp.json

# Review CLAUDE.md for agent references
grep -n "agent" CLAUDE.md | head -20
```

---

## Agent Invocation Patterns

PREP SUPER AGENT delegates to specialized agents via:

1. **Direct invocation** - From `/api/chat` endpoint
2. **Orchestrator pattern** - prep-workflow-orchestrator delegates
3. **Error handling** - error-coordinator spawns recovery agents
4. **Analytics** - analytics-engine for complex calculations

**Example Invocation:**
```typescript
// From prep-workflow-orchestrator
const result = await invokeAgent({
  subagent_type: 'prep-system/airtable-operations',
  task: 'Get stocktake status',
  context: currentWorkflowState
});
```

---

## Next Steps

1. **Week 2:** Complete agent usage audit
2. **Week 3:** Archive unused agents
3. **Week 4:** Document agent delegation patterns
EOF
```

**Verification:**
```bash
cat .claude/agents/ACTIVE_AGENTS.md
# Should display comprehensive documentation
```

---

### Task 3.2: Create Archive Directory Structure

**Safety:** 🟢 SAFE - Preparation only, no moves yet

```bash
cd .claude/agents

# Create archive directory for Week 2
mkdir -p archive/README.md

cat > archive/README.md << 'EOF'
# Archived Agents

**Purpose:** Generic agents not actively used by PREP SYSTEM

**Archived Date:** TBD (Week 2 cleanup)

These agents were moved here after audit confirmed they are:
- Not invoked by PREP SUPER AGENT
- Not referenced in workflow orchestration
- Not planned for immediate feature development

**Categories:**
- `consensus/` - Byzantine fault tolerance, distributed consensus
- `swarm/` - Swarm coordination patterns
- `flow-nexus/` - Flow Nexus platform integration
- `github/` - GitHub workflow automation
- `v3/` - V3 integration architecture
- `sublinear/` - Sublinear algorithm implementations
- `optimization/` - Performance optimization agents
- `specialized/` - Domain-specific agents
- `hive-mind/` - Hive mind coordination
- `templates/` - Agent templates
- `custom/` - Custom experimental agents
- `data/` - Data processing agents
- `neural/` - Neural network agents
- `sparc/` - SPARC methodology agents
- `goal/` - Goal planning agents
- `testing/` - Testing framework agents
- `architecture/` - Architecture design agents

**Restoration:**
If any archived agent is needed for future features:
1. Review agent definition
2. Update for current PREP patterns
3. Move back to appropriate category
4. Update ACTIVE_AGENTS.md

**Deletion Policy:**
Archived agents will be preserved for 6 months.
After 6 months of no usage, consider permanent deletion.
EOF
```

---

## Day 4: Git Commit & Verification (1 hour)

### Task 4.1: Review All Changes

**Safety Check:**
```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Review all changes
git status

# Check diff for each file type
git diff --stat

# Ensure no functional code deleted
git diff | grep "^-" | grep -v "^---" | head -50

# Should show mostly file moves, not deletions
```

**Expected Changes:**
```
prep-knowledge-platform/archive/          (new)
prep-knowledge-platform/scripts/          (new, organized)
docs/STAFF_GUIDE.md                       (renamed)
docs/MANAGER_GUIDE.md                     (renamed)
docs/TECHNICAL_REFERENCE.md               (renamed)
docs/setup/                               (new, split content)
.claude/agents/ACTIVE_AGENTS.md           (new)
.claude/agents/archive/                   (new, empty for Week 2)
CLAUDE.md                                 (updated references)
```

---

### Task 4.2: Commit Changes

```bash
# Stage organized changes
git add prep-knowledge-platform/archive/
git add prep-knowledge-platform/scripts/
git add prep-knowledge-platform/package.json

# Stage documentation changes
git add docs/STAFF_GUIDE.md
git add docs/MANAGER_GUIDE.md
git add docs/TECHNICAL_REFERENCE.md
git add docs/setup/
git add docs/README-Level*.md  # Redirect files

# Stage agent documentation
git add .claude/agents/ACTIVE_AGENTS.md
git add .claude/agents/archive/

# Stage CLAUDE.md updates
git add CLAUDE.md

# Commit with clear message
git commit -m "Week 1 Critical Cleanup: Organize structure without breaking functionality

- Archive 13 dead migration files in prep-knowledge-platform
- Organize utility scripts into logical directories
- Rename docs: Level1/2/3 → STAFF_GUIDE/MANAGER_GUIDE/TECHNICAL_REFERENCE
- Split 52KB SUPABASE_RAG_SETUP.md into focused setup guides
- Document 13 active PREP agents vs 99 generic agents
- Create archive structure for Week 2 agent cleanup

NO FUNCTIONAL CHANGES - all production code preserved.
All changes are organizational and reversible."

# Create tag for this cleanup milestone
git tag -a week1-cleanup -m "Week 1: Critical cleanup complete"
```

---

### Task 4.3: Final Verification

**Run Production Checks:**
```bash
cd prep-knowledge-platform

# 1. Verify Next.js builds
npm run build

# Expected: Successful build
# No import errors from moved files

# 2. Verify database scripts still work
npm run db:check

# Expected: Schema validation passes

# 3. Check for broken imports
grep -r "from.*\.\./\.\./.*migration" src/
grep -r "import.*migration" src/

# Expected: No results (no direct imports of migration files)

# 4. Verify scripts folder accessible
node scripts/schema/check-schema.mjs

# Expected: Script runs without "module not found" errors
```

**Test Core Functionality:**
```bash
# Start dev server
npm run dev

# Manual browser tests:
# 1. Open http://localhost:3000
# 2. Navigate to /prep/stocktake
# 3. Navigate to /prep/ordering
# 4. Test chat interface
# 5. Test search functionality

# All should work identically to before cleanup
```

---

## Rollback Procedure (If Needed) 🆘

If any issues found after cleanup:

```bash
# Option 1: Rollback git commit
git reset --soft HEAD~1
git restore --staged .
git restore .

# Option 2: Restore from backup
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS"
tar -xzf PREP_SYSTEM_BACKUP_*.tar.gz -C "PREP SYSTEM"

# Option 3: Cherry-pick specific files
git checkout HEAD~1 -- prep-knowledge-platform/package.json
git checkout HEAD~1 -- CLAUDE.md
```

---

## Post-Cleanup Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **prep-knowledge-platform root files** | 24 | 2 | 92% cleaner |
| **Loose migration files** | 13 | 0 | 100% organized |
| **Documentation clarity** | Level1/2/3 | Staff/Manager/Tech | ✅ Clear purpose |
| **Large doc files (>50KB)** | 1 | 0 | ✅ Split into focused guides |
| **Agent documentation** | None | ACTIVE_AGENTS.md | ✅ 13 active documented |
| **Disk space freed** | - | 0 MB | (No deletions yet) |

**Note:** Disk space savings will come in Week 2 when large data directories are archived.

---

## Success Criteria ✅

Week 1 cleanup is successful if:

- ✅ All tests pass (`npm run build`, `npm test`)
- ✅ Dev server starts without errors
- ✅ No functional regressions in PREP workflows
- ✅ Documentation renamed and more intuitive
- ✅ prep-knowledge-platform root has <5 files
- ✅ All changes committed to git
- ✅ Backup created and verified
- ✅ Team can review changes in clean git diff

---

## Week 2 Preview

Next week's tasks (after Week 1 verification):

1. **Agent Cleanup** - Audit and archive 99 unused agents
2. **Large Data Archival** - Move RAGFiles/ and KnowledgeBase/ to external storage
3. **UI Project Review** - Document or archive eliza/, UI-TARS-desktop/, vibe-kanban/
4. **Naming Standardization** - Rename PascalCase directories to kebab-case

---

**Estimated Time:** 3-5 hours (can be split across multiple sessions)
**Risk Level:** 🟢 LOW (all changes are reversible, no code deletions)
**Testing Required:** 30 minutes of manual testing after completion

---

**Created:** 2026-02-12
**Status:** Ready for execution
**Approval Required:** No (safe organizational changes only)
