# PREP SYSTEM Folder Reorganization Design

**Date:** 2026-02-15
**Status:** Design Phase
**Goal:** Reorganize folder structure to separate Sakura House and The Waratah as independent restaurant systems

---

## Current Structure

```
POLLEN SYSTEMS/
└── PREP SYSTEM/              # Mixed: Sakura House + The Waratah + experiments
    ├── prep-knowledge-platform/
    ├── scripts/
    ├── SakuraHouseVisualAssets/
    ├── THE WARATAH/          # Nested (feels wrong)
    │   ├── prep-knowledge-platform/
    │   ├── scripts/
    │   └── WaratahVisualAssets/
    ├── eliza/                # ElizaOS - PREP Super Agent framework
    ├── UI-TARS-desktop/      # Unrelated experiment
    ├── reference/            # Shared dev resources
    └── .claude/
```

---

## Target Structure

```
POLLEN SYSTEMS/
├── PREP Systems/
│   ├── Sakura House/
│   │   ├── prep-knowledge-platform/
│   │   ├── scripts/
│   │   ├── config/
│   │   ├── templates/
│   │   ├── docs/
│   │   ├── SakuraHouseVisualAssets/
│   │   └── CLAUDE.md
│   ├── The Waratah/
│   │   ├── prep-knowledge-platform/
│   │   ├── scripts/
│   │   ├── config/
│   │   ├── templates/
│   │   ├── docs/
│   │   ├── WaratahVisualAssets/
│   │   └── CLAUDE.md
│   ├── ElizaOS/                    # PREP Super Agent framework
│   │   └── packages/plugin-prep-airtable/
│   └── Reference/                  # Shared dev resources
│       ├── integrations/
│       ├── claude-tools/
│       └── llm-patterns/
├── UI-TARS-desktop/                # Moved out - unrelated
└── .claude/                        # Top-level Claude config
```

---

## Decision Record

**ElizaOS Placement:**
- **Decision:** Keep with PREP Systems
- **Reason:** Contains `@elizaos/plugin-prep-airtable` - core PREP Super Agent infrastructure
- **Status:** Active development, has own git repo

**UI-TARS-desktop:**
- **Decision:** Move to top level (separate from PREP)
- **Reason:** Unrelated project, no integration with PREP systems
- **Status:** Has own git repo

**Reference Materials:**
- **Decision:** Keep with PREP Systems
- **Reason:** Used by both restaurants for development (Airtable MCP, Claude tools, etc.)

---

## Migration Strategy

### Safety Principles

1. **Create new structure alongside old** - don't delete anything until verified
2. **Move folders one at a time** - test after each move
3. **Preserve git history** - use `git mv` where applicable
4. **Backup first** - existing backups from Feb 12 available
5. **Test independently** - each restaurant can be moved/tested separately

### Key Considerations

**Git Repositories:**
- **Current:** Single repo `thewaratah/PREP-SYSTEM.git` contains everything
- **Target:** Separate repos for each restaurant
  - `sakura-house-prep` (new repo)
  - `waratah-prep` (rename current repo)
- ElizaOS has own git repo → preserve as submodule or subtree
- UI-TARS-desktop has own git repo → stays independent
- Reference/ → **DECISION: Copy to both repos** (full independence, no shared dependencies)

**Git Strategy Decision:**
- **Approach:** Split current monorepo into two independent repos
- **Benefit:** Each restaurant managed independently (clasp, vercel, git workflows)
- **Challenge:** Need to preserve relevant history for each restaurant

**Configuration Updates:**
- `.clasp.json` - Google Apps Script project links
- `vercel.json` / Vercel project settings - deployment configs
- Environment variables - may reference old paths
- CLAUDE.md - documentation references

**What Doesn't Change:**
- Airtable structure (unaffected by folder moves)
- Google Apps Scripts (deployed separately via clasp)
- Vercel deployments (once configs updated)
- Database connections

---

## Migration Plan (Draft - To Be Completed)

### Phase 1: Preparation
- [x] Create full backup (Feb 12 backups exist)
- [x] Document current git status
  - Branch: `cleanup/week2-agents-data`
  - Remote: `https://github.com/thewaratah/PREP-SYSTEM.git`
  - Recent commits preserved
- [x] List all configuration files
  - `.clasp.json`: 2 files (scripts/, THE WARATAH/scripts/)
  - `.env`: Main env files in prep-knowledge-platform/ (both locations)
- [x] Identify environment variable files
  - `/prep-knowledge-platform/.env.local`
  - `/THE WARATAH/prep-knowledge-platform/.env.local`
  - Both need to be copied to new repos

### Phase 2: Create New Structure
- [ ] Create `PREP Systems/` folder
- [ ] Create restaurant subfolders
- [ ] Move UI-TARS-desktop to top level

### Phase 3: Move Sakura House
- [ ] Move folders
- [ ] Update configurations
- [ ] Test deployment

### Phase 4: Move The Waratah
- [ ] Move folders
- [ ] Update configurations
- [ ] Test deployment

### Phase 5: Move Supporting Projects
- [ ] Move ElizaOS
- [ ] Move Reference materials
- [ ] Update .claude/ if needed

### Phase 6: Verification
- [ ] Test both restaurants
- [ ] Verify all deployments
- [ ] Clean up old structure

---

## Git Repository Split Strategy

### Overview

Split the current monorepo (`thewaratah/PREP-SYSTEM.git`) into two independent repos:
- `sakura-house-prep` - New repo for Sakura House
- `waratah-prep` - Rename/continue current repo for The Waratah

### Approach: Keep History for The Waratah, Fresh Start for Sakura House

**Reasoning:**
- Current repo is already "thewaratah/PREP-SYSTEM" - makes sense to keep as Waratah repo
- Sakura House files are mixed in but less established - easier to extract to new repo
- Preserves all commit history for The Waratah where it belongs

### Execution Steps

**Step 1: Create Sakura House Repo (New)**
```bash
# On GitHub: Create new repo sakura-house-prep
# Then locally:
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS"
mkdir -p "PREP Systems/Sakura House"
cd "PREP Systems/Sakura House"
git init
git remote add origin https://github.com/YOUR_ORG/sakura-house-prep.git
```

**Step 2: Copy Sakura House Files**
```bash
# Copy relevant folders (NOT move yet, keep originals safe)
cp -r "../../PREP SYSTEM/prep-knowledge-platform" .
cp -r "../../PREP SYSTEM/scripts" .
cp -r "../../PREP SYSTEM/config" .
cp -r "../../PREP SYSTEM/templates" .
cp -r "../../PREP SYSTEM/docs" .
cp -r "../../PREP SYSTEM/SakuraHouseVisualAssets" .
cp "../../PREP SYSTEM/CLAUDE.md" .
cp -r "../../PREP SYSTEM/reference" ./Reference

# First commit
git add .
git commit -m "Initial commit: Sakura House PREP System

Extracted from monorepo for independent management.
Each restaurant now has its own repo for clasp, vercel, and git workflows.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push -u origin main
```

**Step 3: Reorganize Current Repo for The Waratah**
```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP SYSTEM"

# Create new structure within current repo
mkdir -p "../PREP Systems/The Waratah"

# Git move (preserves history) - move Waratah files
git mv "THE WARATAH/prep-knowledge-platform" "../PREP Systems/The Waratah/"
git mv "THE WARATAH/scripts" "../PREP Systems/The Waratah/"
git mv "THE WARATAH/config" "../PREP Systems/The Waratah/"
git mv "THE WARATAH/templates" "../PREP Systems/The Waratah/"
git mv "THE WARATAH/docs" "../PREP Systems/The Waratah/"
git mv "THE WARATAH/WaratahVisualAssets" "../PREP Systems/The Waratah/"
git mv "THE WARATAH/CLAUDE.md" "../PREP Systems/The Waratah/"

# Copy reference (can't git mv from outside)
cp -r reference "../PREP Systems/The Waratah/Reference"
git add "../PREP Systems/The Waratah/Reference"

# Move ElizaOS to new location
git mv eliza "../PREP Systems/ElizaOS"

# Commit reorganization
git commit -m "Reorganize: Move The Waratah to PREP Systems structure

- Extract The Waratah from nested folder to top-level PREP Systems
- Add Reference materials copy for independent development
- Move ElizaOS to PREP Systems (contains prep-airtable plugin)
- Preserve all git history via git mv

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 4: Clean Up Old Structure**
```bash
# Remove now-empty folders and Sakura files
git rm -r "THE WARATAH"  # Now empty
git rm -r prep-knowledge-platform  # Sakura House copy
git rm -r scripts  # Sakura House copy
git rm -r config
git rm -r templates
git rm -r docs
git rm -r SakuraHouseVisualAssets
git rm CLAUDE.md  # Old monorepo version
git rm -r reference  # Copied to both restaurants

git commit -m "Clean up: Remove old monorepo structure and Sakura House files

Sakura House now in separate repo: sakura-house-prep
This repo is now exclusively The Waratah PREP system.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 5: Move UI-TARS to Top Level**
```bash
# This stays outside PREP Systems
mv "UI-TARS-desktop" "../UI-TARS-desktop"
git add ../UI-TARS-desktop
git commit -m "Move UI-TARS-desktop outside PREP Systems (unrelated project)"
```

**Step 6: Update Remote**
```bash
# Optionally rename repo on GitHub to waratah-prep
# Then update remote:
git remote set-url origin https://github.com/thewaratah/waratah-prep.git
git push
```

### Verification Checklist

After split, verify:
- [ ] Sakura House repo has all files and can build
- [ ] The Waratah repo has all files and can build
- [ ] Both repos have `.git/` (independent version control)
- [ ] ElizaOS still has its own `.git/` inside PREP Systems
- [ ] UI-TARS still has its own `.git/` at top level
- [ ] Reference/ exists in both restaurant folders
- [ ] Git history preserved in Waratah repo
- [ ] Both `.clasp.json` files point to correct GAS projects
- [ ] Both Vercel projects point to correct repos

---

## Next Steps

1. **Review this design** - Does the git split strategy make sense?
2. **Detail Phase 1-6** - Add specific commands for each migration phase
3. **Create backup** - Before any changes
4. **Execute plan** - One phase at a time with verification

---

**Token Usage at Design Start:** ~88K/200K (44%)
