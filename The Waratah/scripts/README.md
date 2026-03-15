# THE WARATAH Scripts Directory

Organized script directory for THE WARATAH project. All utility scripts are now organized by purpose for better maintainability.

## Directory Structure

```
scripts/
├── README.md                          # This file
├── dev/                               # Development & testing utilities
├── setup/                             # One-time setup & migration tools
│   └── archive/                       # Old migration attempts (archived)
├── *.gs                               # Google Apps Scripts (production)
├── *.py                               # Python utilities
└── *.sql                              # Production schema files
```

---

## Development Utilities (`dev/`)

**Purpose:** Testing, debugging, and development-only scripts

### Search & Validation Scripts

| Script | Purpose |
|--------|---------|
| `search-koji.mjs` | Test vector search for "koji" keyword |
| `search-koji-deep.mjs` | Deep search with multiple similarity thresholds |
| `search-koji-text.mjs` | Full-text search testing |
| `check-koji-chunks.mjs` | Verify koji-related chunks in database |
| `check-koji-docs.mjs` | Verify koji documents ingested correctly |
| `check-schema.mjs` | Validate database schema matches expected structure |
| `check-sync-status.mjs` | Check Airtable → Supabase sync status |

### Data Sync Scripts

| Script | Purpose |
|--------|---------|
| `sync-ingredient-db.mjs` | Sync ingredient database from Airtable to RAG |
| `sync-20-records.mjs` | Test sync with 20 records (dev/testing) |

### Testing Scripts

| Script | Purpose |
|--------|---------|
| `test-search.mjs` | Test search functionality with sample queries |
| `test-search-raw.mjs` | Raw pgvector search testing |

### Database Utilities

| Script | Purpose |
|--------|---------|
| `find-and-drop.mjs` | Find and drop specific tables (DANGEROUS - dev only) |

**Usage:**
```bash
cd prep-knowledge-platform
node ../scripts/dev/search-koji.mjs
node ../scripts/dev/check-schema.mjs
```

**Requirements:**
- Node.js 18+
- Environment variables in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `AIRTABLE_PAT`

---

## Setup Tools (`setup/`)

**Purpose:** One-time setup, migrations, and infrastructure scripts

| Script | Purpose |
|--------|---------|
| `apply-migrations-pg.mjs` | Apply migrations to PostgreSQL/Supabase |
| `apply-migrations.js` | Legacy migration applier |
| `run-migrations.mjs` | Run all pending migrations |

**Usage:**
```bash
cd prep-knowledge-platform
node ../scripts/setup/apply-migrations-pg.mjs
```

### Archive (`setup/archive/`)

**Purpose:** Historical migration attempts - kept for reference only

These are duplicate/iterative migration files from development. **DO NOT USE** - all valid migrations are in `prep-knowledge-platform/supabase/migrations/`.

| File | Description |
|------|-------------|
| `migration-FINAL.sql` | Iterative attempt #1 |
| `migration-CRITICAL.sql` | Iterative attempt #2 |
| `migration-FIX.sql` | Iterative attempt #3 |
| `migration-MINIMAL.sql` | Iterative attempt #4 |
| `migration-COMPLETE.sql` | Iterative attempt #5 |
| `migration-WITH-JOIN.sql` | Iterative attempt #6 |
| `all-migrations.sql` | Consolidated version (superseded) |
| `EXACT-DROP.sql` | Drop tables script (dev only) |
| `FORCE-DROP.sql` | Force drop with CASCADE (dev only) |
| `step1-DROP.sql` | Two-step migration: drop |
| `step2-CREATE.sql` | Two-step migration: create |

**Note:** All proper migrations are versioned in `prep-knowledge-platform/supabase/migrations/` and managed via Supabase CLI.

---

## Google Apps Scripts (`.gs` files)

**Purpose:** Production scripts for Google Workspace integration

### Production Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `GoogleDocsPrepSystem.gs` | Main prep doc generator + Slack notifications | ✅ Production |
| `FeedbackForm.gs` | Staff feedback web app backend | ✅ Production |
| `RecipeScaler.gs` | Recipe scaling web app backend | ✅ Production |

### UI Templates

| Template | Purpose |
|----------|---------|
| `FeedbackFormUI.html` | Feedback form interface |
| `RecipeScalerUI.html` | Recipe scaler interface |

### Venue-Specific Scripts (Waratah)

| Script | Purpose |
|--------|---------|
| `Waratah_ClearWeeklyCount.gs` | Initialize new stocktake session |
| `Waratah_FinaliseCount.gs` | Validate and finalize stocktake |
| `Waratah_GeneratePrepRun.gs` | Generate prep tasks from shortfalls |
| `Waratah_GeneratePrepSheet.gs` | Export request processor |
| `Waratah_GeneratePrepSheet_TimeBasedPolling.gs` | Time-triggered export polling |

**Deployment:**
```bash
cd scripts
clasp push
clasp deploy
```

---

## Python Utilities (`.py` files)

| Script | Purpose |
|--------|---------|
| `rag_ingest.py` | Ingest documents into RAG system |
| `rag_query.py` | Query RAG system from command line |

**Usage:**
```bash
python scripts/rag_ingest.py --source docs/
python scripts/rag_query.py "How long does miso cure?"
```

---

## Database Schema (`supabase_schema.sql`)

**Purpose:** Complete Supabase schema definition for reference

**Note:** Actual migrations are in `prep-knowledge-platform/supabase/migrations/` directory. This file is for documentation/reference only.

---

## Best Practices

### Adding New Scripts

1. **Development scripts** → `scripts/dev/`
   - Testing utilities
   - Debugging tools
   - Data validation scripts

2. **Setup scripts** → `scripts/setup/`
   - One-time migrations
   - Infrastructure setup
   - Database initialization

3. **Production scripts** → `scripts/` (root)
   - Google Apps Scripts
   - Production automation
   - Deployment tools

### Script Naming Convention

- `check-*.mjs` - Validation scripts
- `search-*.mjs` - Search testing scripts
- `sync-*.mjs` - Data synchronization scripts
- `test-*.mjs` - Testing utilities
- `*_*.gs` - Google Apps Scripts (Google convention)
- `*.py` - Python utilities

### Documentation

When adding a new script:
1. Add it to this README in the appropriate section
2. Include a clear purpose description
3. Document any required environment variables
4. Provide usage examples

---

## Migration History

**2026-02-12:** Reorganized from 28 root-level files to organized structure
- Moved 12 dev/test scripts to `dev/`
- Moved 3 setup scripts to `setup/`
- Archived 11 duplicate migrations to `setup/archive/`
- Result: Clean root directory with only config files

---

## Troubleshooting

### Script Not Found

If you get "file not found" errors:
```bash
# Old location (WRONG)
node search-koji.mjs

# New location (CORRECT)
node scripts/dev/search-koji.mjs
# or from prep-knowledge-platform:
node ../scripts/dev/search-koji.mjs
```

### Environment Variables Missing

All scripts require environment variables. Create `.env.local` in `prep-knowledge-platform/`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-proj-...
AIRTABLE_PAT=pat...
```

Then load them:
```bash
# Option 1: Use dotenv
node -r dotenv/config scripts/dev/search-koji.mjs

# Option 2: Source in shell
export $(cat .env.local | xargs) && node scripts/dev/search-koji.mjs
```

---

**Last Updated:** 2026-02-12
**Maintained By:** Development Team
**Related Documentation:**
- [CLAUDE.md](../CLAUDE.md) - Development workflow
- [CODE_ANALYSIS_REPORT.md](../CODE_ANALYSIS_REPORT.md) - Architecture analysis
