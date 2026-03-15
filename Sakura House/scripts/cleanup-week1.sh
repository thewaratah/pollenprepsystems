#!/bin/bash

# Week 1 Critical Cleanup Script
# Safe, reversible cleanup with verification at each step

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"
cd "$PROJECT_ROOT"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Week 1: Critical Cleanup Script                 ║${NC}"
echo -e "${BLUE}║       Safe, reversible, non-breaking changes           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Ask for confirmation
confirm() {
    read -p "$(echo -e ${YELLOW}$1 [y/N]: ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted by user"
        exit 1
    fi
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

print_step "Pre-flight checks..."

# Check we're in the right directory
if [ ! -f "CLAUDE.md" ]; then
    print_error "Not in PREP SYSTEM root directory"
    exit 1
fi
print_success "In correct directory"

# Check git status
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    print_warning "Git working directory is not clean"
    git status --short
    confirm "Continue anyway?"
fi

# ============================================================================
# STEP 0: CREATE BACKUP
# ============================================================================

print_step "Step 0: Creating backup..."

BACKUP_DIR="/Users/evanstroevee/Desktop/POLLEN SYSTEMS"
BACKUP_NAME="PREP_SYSTEM_BACKUP_$(date +%Y%m%d_%H%M%S).tar.gz"

echo "Creating backup at: $BACKUP_DIR/$BACKUP_NAME"

tar -czf "$BACKUP_DIR/$BACKUP_NAME" \
    --exclude="node_modules" \
    --exclude="reference" \
    --exclude="RAGFiles" \
    --exclude="KnowledgeBase" \
    --exclude=".git" \
    . 2>/dev/null

if [ -f "$BACKUP_DIR/$BACKUP_NAME" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
    print_success "Backup created: $BACKUP_SIZE"
else
    print_error "Backup creation failed"
    exit 1
fi

# ============================================================================
# STEP 1: CREATE GIT BRANCH
# ============================================================================

print_step "Step 1: Creating cleanup branch..."

if git rev-parse --verify cleanup/week1-critical >/dev/null 2>&1; then
    print_warning "Branch 'cleanup/week1-critical' already exists"
    confirm "Switch to existing branch?"
    git checkout cleanup/week1-critical
else
    git checkout -b cleanup/week1-critical
    print_success "Created and switched to 'cleanup/week1-critical'"
fi

# ============================================================================
# STEP 2: PREP-KNOWLEDGE-PLATFORM CLEANUP
# ============================================================================

print_step "Step 2: Cleaning up prep-knowledge-platform root..."

cd prep-knowledge-platform

# Create archive directories
mkdir -p archive/old-migrations
mkdir -p archive/debug-scripts
mkdir -p scripts/migrations
mkdir -p scripts/search-tests
mkdir -p scripts/sync
mkdir -p scripts/schema

# Count files before
FILES_BEFORE=$(ls -1 *.sql *.mjs 2>/dev/null | wc -l | tr -d ' ')
echo "Files in root before: $FILES_BEFORE"

# Move migration files
print_step "  Moving migration files..."
MIGRATION_FILES=(
    "EXACT-DROP.sql"
    "FORCE-DROP.sql"
    "step1-DROP.sql"
    "step2-CREATE.sql"
    "migration-MINIMAL.sql"
    "migration-COMPLETE.sql"
    "migration-CRITICAL.sql"
    "migration-FINAL.sql"
    "migration-FIX.sql"
    "migration-WITH-JOIN.sql"
    "all-migrations.sql"
)

MOVED_COUNT=0
for file in "${MIGRATION_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" archive/old-migrations/
        ((MOVED_COUNT++))
    fi
done
print_success "  Moved $MOVED_COUNT migration files"

# Create README for archive
cat > archive/old-migrations/README.md << 'EOF'
# Archived Migration Files

**Archived:** 2026-02-12
**Reason:** Superseded by production migrations in `supabase/migrations/`

These files were created during iterative development and debugging.
The canonical migrations are now in `supabase/migrations/`.

**Do not apply these archived migrations to production.**

If needed for historical reference, they are preserved here.
EOF

# Move utility scripts
print_step "  Organizing utility scripts..."

# Migration utilities
[ -f "apply-migrations-pg.mjs" ] && mv apply-migrations-pg.mjs scripts/migrations/
[ -f "run-migrations.mjs" ] && mv run-migrations.mjs scripts/migrations/

# Search test scripts
[ -f "search-koji.mjs" ] && mv search-koji.mjs scripts/search-tests/
[ -f "search-koji-deep.mjs" ] && mv search-koji-deep.mjs scripts/search-tests/
[ -f "search-koji-text.mjs" ] && mv search-koji-text.mjs scripts/search-tests/
[ -f "test-search.mjs" ] && mv test-search.mjs scripts/search-tests/
[ -f "test-search-raw.mjs" ] && mv test-search-raw.mjs scripts/search-tests/

# Sync utilities
[ -f "sync-ingredient-db.mjs" ] && mv sync-ingredient-db.mjs scripts/sync/

# Schema utilities
[ -f "check-schema.mjs" ] && mv check-schema.mjs scripts/schema/
[ -f "check-koji-chunks.mjs" ] && mv check-koji-chunks.mjs scripts/schema/
[ -f "check-koji-docs.mjs" ] && mv check-koji-docs.mjs scripts/schema/

# Debug scripts
[ -f "find-and-drop.mjs" ] && mv find-and-drop.mjs archive/debug-scripts/
[ -f "apply-migrations.js" ] && mv apply-migrations.js archive/debug-scripts/

# Create READMEs
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
EOF

cat > scripts/schema/README.md << 'EOF'
# Schema Validation Scripts

Scripts for validating database schema and RAG data integrity.
EOF

# Count files after
FILES_AFTER=$(ls -1 *.sql *.mjs 2>/dev/null | wc -l | tr -d ' ')
echo "Files in root after: $FILES_AFTER"
print_success "Cleaned up $((FILES_BEFORE - FILES_AFTER)) files from root"

cd "$PROJECT_ROOT"

# ============================================================================
# STEP 3: DOCUMENTATION REORGANIZATION
# ============================================================================

print_step "Step 3: Reorganizing documentation..."

cd docs

# Rename Level-based docs
if [ -f "README-Level1-Basic.md" ]; then
    mv README-Level1-Basic.md STAFF_GUIDE.md
    print_success "  Renamed to STAFF_GUIDE.md"
fi

if [ -f "README-Level2-Intermediate.md" ]; then
    mv README-Level2-Intermediate.md MANAGER_GUIDE.md
    print_success "  Renamed to MANAGER_GUIDE.md"
fi

if [ -f "README-Level3-DeepDive.md" ]; then
    mv README-Level3-DeepDive.md TECHNICAL_REFERENCE.md
    print_success "  Renamed to TECHNICAL_REFERENCE.md"
fi

# Create redirect files
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

# Create setup directory
mkdir -p setup

if [ -f "SUPABASE_RAG_SETUP.md" ]; then
    cp SUPABASE_RAG_SETUP.md setup/SUPABASE_RAG_SETUP_ORIGINAL.md
    print_success "  Copied SUPABASE_RAG_SETUP.md to setup/"
    print_warning "  Manual split required - see docs/plans/WEEK1_CRITICAL_CLEANUP.md"
fi

cat > setup/README.md << 'EOF'
# PREP SYSTEM Setup Guides

## Database Setup

1. [Original Setup Guide](SUPABASE_RAG_SETUP_ORIGINAL.md) - Complete setup guide

**TODO:** Split into focused guides:
- SUPABASE_INITIAL_SETUP.md
- RAG_CONFIGURATION.md
- MIGRATION_DEPLOYMENT.md

---

**Note:** Manual split required to preserve section context.
See: docs/plans/WEEK1_CRITICAL_CLEANUP.md Task 2.2
EOF

cd "$PROJECT_ROOT"

# ============================================================================
# STEP 4: AGENT DOCUMENTATION
# ============================================================================

print_step "Step 4: Documenting agent architecture..."

cd .claude/agents

# Create ACTIVE_AGENTS.md
cat > ACTIVE_AGENTS.md << 'EOF'
# Active PREP SYSTEM Agents

**Last Updated:** 2026-02-12
**Total Agents:** 112
**Active for PREP:** 13 (12%)

## Core PREP Agents (13) - ✅ ACTIVE

### Orchestration Layer
- `prep-system/prep-workflow-orchestrator.md` - Central coordination
- `prep-system/workflow-states.md` - State machine

### Data & Query Layer
- `prep-system/airtable-operations.md` - Airtable MCP
- `prep-system/query-handler.md` - NLP queries

### Intelligence Layer
- `prep-system/decision-engine.md` - Automated decisions
- `prep-system/analytics-engine.md` - Analytics

### Error & Recovery
- `prep-system/error-coordinator.md` - Error handling

### Feedback & Learning
- `prep-system/feedback-processor.md` - Feedback automation

### Operations & Monitoring
- `prep-system/testing-framework.md` - Testing
- `prep-system/monitoring-dashboard.md` - Monitoring
- `prep-system/health-check.md` - Validation

### Development & Support
- `prep-system/prep-gas-developer.md` - GAS specialist
- `prep-system/staff-guide.md` - Documentation

## Generic Agents (99) - ⚠️ UNDER REVIEW

99 agents pending audit for Week 2 archival.

See: docs/plans/WEEK1_CRITICAL_CLEANUP.md
EOF

print_success "Created ACTIVE_AGENTS.md"

# Create archive directory structure
mkdir -p archive

cat > archive/README.md << 'EOF'
# Archived Agents

**Purpose:** Generic agents not actively used by PREP SYSTEM
**Archived Date:** TBD (Week 2)

Agents will be moved here after Week 2 audit confirms they are:
- Not invoked by PREP SUPER AGENT
- Not planned for immediate features

**Restoration:** Move back to appropriate category if needed.
**Deletion Policy:** Preserved for 6 months, then consider deletion.
EOF

print_success "Created archive structure for Week 2"

cd "$PROJECT_ROOT"

# ============================================================================
# STEP 5: UPDATE CLAUDE.MD
# ============================================================================

print_step "Step 5: Updating CLAUDE.md references..."

# Backup CLAUDE.md
cp CLAUDE.md CLAUDE.md.backup

# Update documentation references
sed -i.bak 's/README-Level1-Basic\.md/STAFF_GUIDE.md/g' CLAUDE.md
sed -i.bak 's/README-Level2-Intermediate\.md/MANAGER_GUIDE.md/g' CLAUDE.md
sed -i.bak 's/README-Level3-DeepDive\.md/TECHNICAL_REFERENCE.md/g' CLAUDE.md

# Remove backup file
rm CLAUDE.md.bak

CHANGES=$(diff -u CLAUDE.md.backup CLAUDE.md | grep "^-.*Level" | wc -l)
print_success "Updated $CHANGES documentation references in CLAUDE.md"

# ============================================================================
# STEP 6: VERIFICATION
# ============================================================================

print_step "Step 6: Running verification checks..."

# Check prep-knowledge-platform builds
cd prep-knowledge-platform
print_step "  Verifying Next.js can build..."
if npm run build >/dev/null 2>&1; then
    print_success "  Next.js build successful"
else
    print_error "  Next.js build failed - check for broken imports"
    exit 1
fi

cd "$PROJECT_ROOT"

# Check git status
print_step "  Checking git status..."
git status --short

# ============================================================================
# STEP 7: GIT COMMIT
# ============================================================================

print_step "Step 7: Committing changes..."

# Stage all changes
git add prep-knowledge-platform/archive/
git add prep-knowledge-platform/scripts/
git add docs/STAFF_GUIDE.md
git add docs/MANAGER_GUIDE.md
git add docs/TECHNICAL_REFERENCE.md
git add docs/README-Level*.md
git add docs/setup/
git add .claude/agents/ACTIVE_AGENTS.md
git add .claude/agents/archive/
git add CLAUDE.md

# Show what will be committed
echo ""
echo "Changes to be committed:"
git status --short

echo ""
confirm "Commit these changes?"

# Commit
git commit -m "Week 1 Critical Cleanup: Organize structure without breaking functionality

- Archive 13 dead migration files in prep-knowledge-platform
- Organize utility scripts into logical directories
- Rename docs: Level1/2/3 → STAFF_GUIDE/MANAGER_GUIDE/TECHNICAL_REFERENCE
- Document 13 active PREP agents vs 99 generic agents
- Create archive structure for Week 2 agent cleanup

NO FUNCTIONAL CHANGES - all production code preserved.
All changes are organizational and reversible.

Backup created: $BACKUP_NAME"

# Create tag
git tag -a week1-cleanup -m "Week 1: Critical cleanup complete"

print_success "Changes committed and tagged"

# ============================================================================
# COMPLETION SUMMARY
# ============================================================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Week 1 Cleanup Complete! ✓                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Summary:"
echo "  ✓ Backup created: $BACKUP_SIZE"
echo "  ✓ Git branch: cleanup/week1-critical"
echo "  ✓ Migration files archived: $MOVED_COUNT"
echo "  ✓ Documentation renamed (Level → Purpose)"
echo "  ✓ Agent directory documented"
echo "  ✓ All changes committed"
echo ""

echo "Next steps:"
echo "  1. Review changes: git log --stat"
echo "  2. Test functionality: cd prep-knowledge-platform && npm run dev"
echo "  3. Merge to main: git checkout main && git merge cleanup/week1-critical"
echo "  4. Plan Week 2: docs/plans/WEEK1_CRITICAL_CLEANUP.md (bottom)"
echo ""

echo "Rollback (if needed):"
echo "  git reset --hard HEAD~1"
echo "  OR: Extract backup at $BACKUP_DIR/$BACKUP_NAME"
echo ""

print_success "Week 1 cleanup completed successfully!"
