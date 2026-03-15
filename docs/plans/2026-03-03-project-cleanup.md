# Project Cleanup Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce project bloat, remove superseded files, and clarify structure across `.claude/`, `docs/`, `The Waratah/`, and `Reference/` — without touching Sakura House or breaking any production pipeline.

**Architecture:** Read-only analysis completed 2026-03-03. No code changes — only file deletions, moves, and archiving. All changes are reversible via backup or Trash.

**Tech Stack:** macOS filesystem (Finder/Trash as safety net), bash rm/mv, no git (no repo at PREP Systems root)

**Estimated disk reclaim:** ~1.3GB (mostly Reference/claude-flow old versions)

**Pre-flight rule:** Any file marked DELETE should go to macOS Trash first — do not `rm -rf`. Recover from Trash within 30 days if needed.

---

## Questions for the User Before Executing

Before starting, confirm the following three decisions (the rest can proceed without input):

1. **`The Waratah/docs/CLAUDE.md` (2,076 lines)** — This is a pre-split comprehensive CLAUDE.md from when Waratah and Sakura were a single system. It references old paths (`scripts/` not `The Waratah/scripts/`), Sakura staff names (Gooch/Sabs), and `GeneratePrepSheet.gs` without the `Waratah_` prefix. It is NOT the current canonical guide (`The Waratah/CLAUDE.md` at 494 lines is).
   - **Option A:** Archive → move to `The Waratah/docs/archive/CLAUDE-pre-split.md`
   - **Option B:** Delete → move to Trash
   - **Option C:** Leave it (explain why it's needed)

2. **`Reference/claude-tools/claude-flow/v2/` (146MB) and `v3/` (1.1GB)** — The current `claude-flow/` root is the active version. v2 and v3 appear to be archived snapshots with their own `node_modules` installed (hence the size). They were presumably kept as fallback references.
   - **Option A:** Delete both → move to Trash (~1.25GB saved)
   - **Option B:** Archive v3 only (most recent fallback) and delete v2
   - **Option C:** Keep both

3. **`Reference/automation/ohmyzsh/` (24MB)** — The Zsh shell framework. Not used anywhere in the PREP pipeline.
   - **Option A:** Delete → move to Trash
   - **Option B:** Keep (if you actively reference it for shell config)

---

## Task 1: Remove macOS Junk Files

**Files:** All `.DS_Store` files throughout project (estimated 180+)

**Risk:** None — macOS recreates these automatically, ignored by git

**Step 1: Preview count**
```bash
cd "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems"
find . -name ".DS_Store" | grep -v "node_modules" | wc -l
```

**Step 2: Delete**
```bash
find . -name ".DS_Store" -not -path "*/node_modules/*" -delete
```

**Step 3: Verify**
```bash
find . -name ".DS_Store" -not -path "*/node_modules/*" | wc -l
# Expected: 0
```

**Disk saved:** Negligible (< 1MB) but reduces noise in file listings.

---

## Task 2: Delete Superseded GAS Script

**File:** `The Waratah/scripts/Waratah_GeneratePrepSheet.gs`

**Why:** Superseded by `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` which is the canonical current implementation. The single-record version is explicitly flagged as obsolete in `The Waratah/CLAUDE.md` and the waratah-prep-agent instructions.

**Pre-condition:** Confirm `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` is the active script in the Airtable automation for The Waratah (not the non-polling version).

**Step 1: Verify the polling version exists and is current**
```bash
ls -la "The Waratah/scripts/Waratah_GeneratePrepSheet_TimeBasedPolling.gs"
head -5 "The Waratah/scripts/Waratah_GeneratePrepSheet_TimeBasedPolling.gs"
```

**Step 2: Move superseded script to Trash**
```bash
# Using macOS trash (safe)
osascript -e 'tell app "Finder" to delete POSIX file "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/The Waratah/scripts/Waratah_GeneratePrepSheet.gs"'
```

**Step 3: Update CLAUDE.md reference**

In `The Waratah/CLAUDE.md`, confirm the file listing no longer shows `Waratah_GeneratePrepSheet.gs` as active. The waratah-prep-agent.md already correctly marks this as NEVER upload to GAS — the deletion clarifies this further.

**Disk saved:** Negligible

---

## Task 3: Archive Completed Planning Document

**File:** `The Waratah/docs/DIRECTORY-ANALYSIS.md`

**Why:** This is a reorganization plan dated 2026-02-01. Most of its proposed moves have been completed (the `Reference/` folder structure now matches the proposal). The remaining action items were minor and some are now outdated (e.g., it references `.claude/agents/prep-system/` which is now flat `.claude/agents/`).

**Step 1: Read the file and confirm it's stale**
```bash
head -20 "The Waratah/docs/DIRECTORY-ANALYSIS.md"
# Should show "Analysis Date: 2026-02-01" at the bottom
```

**Step 2: Create archive folder if it doesn't exist**
```bash
mkdir -p "The Waratah/docs/archive"
```

**Step 3: Move to archive**
```bash
mv "The Waratah/docs/DIRECTORY-ANALYSIS.md" "The Waratah/docs/archive/DIRECTORY-ANALYSIS-2026-02-01.md"
```

**Step 4: Verify**
```bash
ls "The Waratah/docs/archive/"
```

**Disk saved:** Negligible

---

## Task 4: Archive or Delete Pre-Split CLAUDE.md

**File:** `The Waratah/docs/CLAUDE.md` (2,076 lines)

**Why:** This is an older, comprehensive CLAUDE.md from before the Waratah/Sakura split. It references Sakura staff (Gooch/Sabs), old script paths, and the old single-venue structure. The current canonical guides are:
- `The Waratah/CLAUDE.md` (494 lines, maintained, current)
- `CLAUDE.md` at project root (navigation guide)

**Awaiting user decision** (Question 1 above). Proceed based on answer:

**If Option A (archive):**
```bash
mkdir -p "The Waratah/docs/archive"
mv "The Waratah/docs/CLAUDE.md" "The Waratah/docs/archive/CLAUDE-pre-split-2026-02-01.md"
```

**If Option B (delete):**
```bash
osascript -e 'tell app "Finder" to delete POSIX file "/Users/evanstroevee/Desktop/POLLEN SYSTEMS/PREP Systems/The Waratah/docs/CLAUDE.md"'
```

**Disk saved:** Negligible (~150KB), but eliminates confusion with the active CLAUDE.md.

---

## Task 5: Delete claude-flow Old Versions

**Files:**
- `Reference/claude-tools/claude-flow/v2/` (146MB)
- `Reference/claude-tools/claude-flow/v3/` (1.1GB)

**Why:** The active claude-flow is at `Reference/claude-tools/claude-flow/` (root level). v2 and v3 are snapshot archives from previous versions, each with their own `node_modules` installed locally. No agent instruction file references v2/ or v3/ paths.

**Awaiting user decision** (Question 2 above). Proceed based on answer:

**Step 1: Verify no references to v2/v3 in agent files**
```bash
grep -r "claude-flow/v[23]" ".claude/agents/" ".claude/commands/" "CLAUDE.md" 2>/dev/null
# Expected: no output
```

**Step 2: Delete (if approved)**
```bash
# v2 (146MB)
rm -rf "Reference/claude-tools/claude-flow/v2"

# v3 (1.1GB) — do this separately so you can stop if needed
rm -rf "Reference/claude-tools/claude-flow/v3"
```

> Note: These are large `node_modules` trees — `rm -rf` is appropriate here and faster than Trash. Confirm before running.

**Step 3: Verify**
```bash
ls "Reference/claude-tools/claude-flow/"
# v2/ and v3/ should be gone; main files remain
```

**Disk saved:** ~1.25GB

---

## Task 6: Delete ohmyzsh Reference Folder

**File:** `Reference/automation/ohmyzsh/` (24MB)

**Why:** The Zsh shell framework. Not referenced in any PREP System agent, command, or script. Not related to the kitchen prep pipeline. Only present as part of a broad reference collection.

**Awaiting user decision** (Question 3 above). Proceed if approved:

**Step 1: Verify no references**
```bash
grep -r "ohmyzsh" ".claude/" "CLAUDE.md" "The Waratah/CLAUDE.md" 2>/dev/null
# Expected: no output
```

**Step 2: Delete**
```bash
rm -rf "Reference/automation/ohmyzsh"
```

**Disk saved:** 24MB

---

## Task 7: Verify .gitignore Completeness (The Waratah)

**Why:** The `prep-knowledge-platform/.gitignore` correctly excludes `.env*`, `node_modules`, `.next/`, `coverage/` — these are properly NOT in version control. However, the `.next/` and `node_modules/` directories exist locally and take up disk space. This task verifies the build state and optionally cleans the local build cache.

**Step 1: Confirm gitignore is correct**
```bash
cat "The Waratah/prep-knowledge-platform/.gitignore" | grep -E "\.env|next|node_modules|coverage"
# Should show all four exclusions
```

**Step 2: Check local disk usage of build artifacts**
```bash
du -sh "The Waratah/prep-knowledge-platform/.next" 2>/dev/null
du -sh "The Waratah/prep-knowledge-platform/node_modules" 2>/dev/null
du -sh "The Waratah/prep-knowledge-platform/coverage" 2>/dev/null
```

**Step 3: Optional — clean .next/ and coverage/ (not node_modules)**
> Only do this if you want to reclaim disk. Run `npm run build` in the platform dir before next deployment to regenerate.
```bash
# Safe to delete — regenerated by next build
rm -rf "The Waratah/prep-knowledge-platform/.next"
rm -rf "The Waratah/prep-knowledge-platform/coverage"
```

**Step 4: Note on duplicate build manifests**
The `.next/` directory contained several files with ` 2.json` suffixes (e.g., `build-manifest 2.json`, `routes-manifest 2.json`). These are macOS duplicate-naming artifacts from Finder copy operations, not from Next.js itself. If you clean and rebuild `.next/` (Step 3), these will not reappear.

---

## Task 8: Clean Up The Waratah docs/ Subfolder

**Scope:** `The Waratah/docs/` — review remaining files after Tasks 3 and 4

**Remaining files to review:**
- `AIRTABLE-RECIPE-SYNC.md` — technical reference for the recipe sync webhook. Keep.
- `MANAGER_GUIDE.md` — staff management guide. Keep.
- `PREP-AGENT-A4-SUMMARY.md` — capability summary. **Review:** is this still accurate? If outdated, archive.
- `README-Level1-Basic.md`, `README-Level2-Intermediate.md`, `README-Level3-DeepDive.md` — audience-split docs. Keep if actively used for onboarding.
- `STAFF_GUIDE.md` — end-user guide. Keep.
- `SUPABASE_RAG_SETUP.md` — RAG setup reference. Keep (may be needed if RAG infra changes).
- `TECHNICAL_REFERENCE.md` — architecture reference. Keep.
- `guides/` subfolder — check for empty or redundant files.
- `plans/` subfolder — check for completed plans.
- `setup/` subfolder — check contents.
- `solutions/` subfolder — check contents.

**Step 1: List all files**
```bash
find "The Waratah/docs/" -type f | sort
```

**Step 2: Review PREP-AGENT-A4-SUMMARY.md**
```bash
head -30 "The Waratah/docs/PREP-AGENT-A4-SUMMARY.md"
# Check if it still reflects current system (13 agents, correct agent names)
```

**Step 3: Flag anything stale for follow-up**
Report any file whose content doesn't match the current system state.

---

## Task 9: Archive Completed Root-Level Plan Files

**Files:**
- `docs/plans/2026-03-03-agent-enhancement-from-reference.md` (622 lines)
- `docs/plans/2026-03-03-agent-enhancement-round-2.md` (787 lines)

**Why:** Both plan files drove the Round 1 and Round 2 agent enhancement sessions. All 9 Round 2 tasks and the relevant Round 1 tasks are confirmed complete. These are historical records.

**Step 1: Confirm completion status**

Read the task checklist in each file and confirm no pending tasks remain.

**Step 2: Create archive folder**
```bash
mkdir -p "docs/archive/plans"
```

**Step 3: Move completed plans to archive**
```bash
mv "docs/plans/2026-03-03-agent-enhancement-from-reference.md" "docs/archive/plans/"
mv "docs/plans/2026-03-03-agent-enhancement-round-2.md" "docs/archive/plans/"
```

**Step 4: Verify docs/plans/ is now empty except for this plan**
```bash
ls "docs/plans/"
# Only 2026-03-03-project-cleanup.md should remain (this file)
```

---

## Task 10: Review Debug.gs

**File:** `The Waratah/scripts/Debug.gs`

**Why:** A utility debugging script in the GAS scripts folder. It is NOT in `.claspignore` (so it deploys to GAS). Need to confirm whether it's intentionally deployed or should be excluded.

**Step 1: Read the file**
```bash
cat "The Waratah/scripts/Debug.gs"
```

**Step 2: Check .claspignore**
```bash
cat "The Waratah/scripts/.claspignore"
```

**Step 3: Decide**
- If Debug.gs contains only development utilities (console logging, test helpers): add to `.claspignore` and note in `The Waratah/CLAUDE.md`
- If it contains production helpers used by other scripts: keep deployed as-is
- If it's unused: delete

---

## Summary Table

| Task | File(s) | Action | Risk | Disk Saved | Decision Needed? |
|------|---------|--------|------|-----------|-----------------|
| 1 | `.DS_Store` (180+ files) | Delete | None | < 1MB | No — proceed |
| 2 | `Waratah_GeneratePrepSheet.gs` | Trash | Low | Negligible | No — proceed |
| 3 | `docs/DIRECTORY-ANALYSIS.md` | Archive | None | Negligible | No — proceed |
| 4 | `The Waratah/docs/CLAUDE.md` | Archive or Delete | Low | ~150KB | **Yes — Q1** |
| 5 | `claude-flow/v2/` + `v3/` | Delete | Medium | **~1.25GB** | **Yes — Q2** |
| 6 | `ohmyzsh/` | Delete | Low | 24MB | **Yes — Q3** |
| 7 | `.next/`, `coverage/` (optional) | Clean | None | ~200MB | Optional |
| 8 | `The Waratah/docs/` misc | Review | None | Negligible | After review |
| 9 | 2 completed plan files | Archive | None | Negligible | No — proceed |
| 10 | `Debug.gs` | Review → decide | Low | Negligible | After review |

**Total confirmed savings (Tasks 1–3, 9):** negligible disk, significant file-count reduction
**Total savings pending decisions (Tasks 4–7):** up to ~1.47GB

---

## Not Included in This Cleanup

The following were considered and **excluded** from the plan:

| Item | Reason Excluded |
|------|----------------|
| `.env` / `.env.local` credentials | Properly gitignored — NOT in version control. No action needed. |
| `Reference/automation/awesome-n8n-templates/` | Informational; could be useful as a future automation reference. Kept pending Q3. |
| `Reference/integrations/xero-mcp-server/` | Noted as aspirational/future feature. Kept. |
| `The Waratah/docs/README-Level*.md` | Audience-segmented guides. Keep for onboarding. |
| `The Waratah/prep-knowledge-platform/node_modules/` | 3.5GB but gitignored and needed for local dev. Only clean if disk pressure is severe. |
| Knowledge platform README files | Multiple but each serves a distinct audience. Keep. |
| Sakura House/ | Excluded from scope per user instruction. |

---

*Plan created: 2026-03-03*
*Analysis by: Claude Sonnet 4.6 + Explore agent*
*Status: Awaiting user answers to Q1, Q2, Q3 before executing Tasks 4–6*
