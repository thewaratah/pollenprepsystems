# Waratah PREP Knowledge Platform

**Separate deployment for The Waratah venue** using `waratah_*` prefixed RAG tables.

---

## Setup Complete ✅

### 1. Environment Configuration

**File:** `.env`

```env
# Supabase - Waratah RAG Tables
NEXT_PUBLIC_SUPABASE_URL=https://jtacdnkqvypriosgheih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Venue Selection - WARATAH
NEXT_PUBLIC_VENUE_ID=waratah

# Airtable - Waratah
AIRTABLE_BASE_ID=wspB1DzuXWuxEAhCD
WARATAH_AIRTABLE_BASE_ID=wspB1DzuXWuxEAhCD
WARATAH_GAS_WEBAPP_URL=https://script.google.com/macros/s/AKfycbx.../exec
```

### 2. Database Tables (Supabase)

**Migration:** `supabase/migrations/005_waratah_rag_tables.sql`

✅ Applied successfully via Supabase Dashboard

**Tables Created:**
- `waratah_rag_documents` - Document metadata
- `waratah_rag_chunks` - Text chunks with embeddings (1536 dims)
- `waratah_rag_categories` - Category taxonomy
- `waratah_search_analytics` - Search performance tracking

**Functions Created:**
- `waratah_match_chunks(query_embedding, threshold, limit)` - Vector search
- `waratah_hybrid_search(query_text, query_embedding, ...)` - Hybrid search

**Indexes:**
- IVFFlat index on embeddings (300 lists for ~90K chunks)
- Full-text search index on content
- Standard indexes on document_id and chunk_index

### 3. Code Updates

**Updated Files:**

| File | Changes |
|------|---------|
| `src/lib/search.ts` | Updated to use `waratah_match_chunks` and `waratah_hybrid_search` functions |
| `src/app/api/sync/recipe/route.ts` | Updated to use `waratah_rag_*` tables |
| `src/app/api/stats/route.ts` | Updated to use `waratah_rag_*` tables |

**Key Changes:**
```typescript
// Vector search
await supabase.rpc('waratah_match_chunks', { ... });

// Hybrid search
await supabase.rpc('waratah_hybrid_search', { ... });

// Analytics
await supabase.from('waratah_search_analytics').insert({ ... });

// Recipe sync
await supabase.from('waratah_rag_documents').insert({ ... });
```

### 4. GAS Scripts Deployed

**Location:** `../scripts/`

**Deployed Scripts:**
- `GoogleDocsPrepSystem.gs` - Main export + unified web app router
- `FeedbackForm.gs` - Staff feedback collection backend
- `FeedbackFormUI.html` - Feedback form interface
- `RecipeScaler.gs` - Recipe scaling backend
- `RecipeScalerUI.html` - Recipe scaler interface

**Staff Names Updated:**
- Gooch → **Andie**
- Sabs → **Blade**

**Script Properties Required:**
```
AIRTABLE_BASE_ID = wspB1DzuXWuxEAhCD
AIRTABLE_PAT = <your-pat>
DOCS_FOLDER_ID = 1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx

SLACK_WEBHOOK_WARATAH_ANDIE = <andie-webhook>
SLACK_WEBHOOK_WARATAH_BLADE = <blade-webhook>
SLACK_WEBHOOK_WARATAH_PREP = <prep-webhook>
SLACK_WEBHOOK_WARATAH_TEST = <test-webhook>

WARATAH_GAS_WEBAPP_URL = <deployment-url>
```

---

## Running the Platform

### Development

```bash
cd "THE WARATAH/prep-knowledge-platform"
npm run dev
```

Platform will be available at: `http://localhost:3000`

### Production Build

```bash
npm run build
npm run start
```

---

## API Endpoints

### Knowledge Base

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Chat with PREP Agent (Claude + RAG + Tools) |
| `/api/search` | POST | Search Waratah knowledge base |
| `/api/stats` | GET | Knowledge base statistics |
| `/api/sync/recipe` | POST | Sync recipe from Airtable to RAG |
| `/api/sync/recipe?all=true` | GET | Bulk sync all recipes |

### PREP Operations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prep/counts` | GET | Fetch all active items with weekly counts |
| `/api/prep/counts` | PATCH | Update single item's stock count |
| `/api/prep/counts/clear` | POST | Clear weekly counts |
| `/api/prep/workflow/generate` | POST | Run full workflow (finalize → generate → export) |

---

## Next Steps

### 1. RAG Knowledge Base Ingestion

**Option A: Manual File Upload**
1. Place documents in a local directory
2. Use a Python ingestion script (similar to Sakura's `rag_ingest.py`)
3. Generate embeddings using OpenAI
4. Insert into `waratah_rag_documents` and `waratah_rag_chunks`

**Option B: Recipe Sync from Airtable**
1. Set up Airtable automation on Recipes table
2. Trigger webhook: `POST /api/sync/recipe` with `recipeId`
3. Recipes are automatically embedded and synced to RAG

### 2. Test the Platform

```bash
# 1. Start dev server
npm run dev

# 2. Test search
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "How to make ponzu?"}'

# 3. Test stats
curl http://localhost:3000/api/stats

# 4. Test chat (Super Agent)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is the prep status?"}]}'
```

### 3. Deploy to Production

**Vercel Deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# - All variables from .env file
# - Ensure NEXT_PUBLIC_VENUE_ID=waratah
```

### 4. Configure Airtable Automations

**Prep Run Export Trigger:**
1. Airtable → Automations → Create new
2. Trigger: When `Export Request State = "REQUESTED"` in Prep Runs
3. Action: Run script → Call Waratah GAS webhook

**Recipe Sync (Optional):**
1. Airtable → Automations → Create new
2. Trigger: When recipe created/updated in Recipes table
3. Action: Run script → Call `POST /api/sync/recipe`

---

## Data Isolation

✅ **Complete separation from Sakura:**
- Separate Airtable base: `wspB1DzuXWuxEAhCD`
- Separate Supabase tables: `waratah_*` prefix
- Separate Google Drive folder: `1Zekjhk78dwH5MNoHXnvu1zI4VtbZNckx`
- Separate Slack webhooks: `SLACK_WEBHOOK_WARATAH_*`
- Separate GAS deployment

**No shared data between venues.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Waratah PREP Knowledge Platform               │
│                  (Next.js + React)                      │
├─────────────────────────────────────────────────────────┤
│  /api/chat       │  Claude Sonnet 4 + PREP Tools        │
│  /api/search     │  Vector + Hybrid search (Waratah)    │
│  /api/sync/recipe│  Airtable → RAG sync                 │
└─────────────────────────────────────────────────────────┘
          │                      │                    │
          ▼                      ▼                    ▼
    ┌──────────┐          ┌──────────┐         ┌──────────┐
    │ Supabase │          │ OpenAI   │         │ Airtable │
    │ waratah_*│          │ Embed    │         │ Waratah  │
    │ tables   │          │ API      │         │  Base    │
    └──────────┘          └──────────┘         └──────────┘
```

---

## Staff Names

| Sakura | Waratah |
|--------|---------|
| Gooch  | **Andie** |
| Sabs   | **Blade** |

---

## Troubleshooting

### Search returns empty results
- Verify RAG tables are populated: `SELECT COUNT(*) FROM waratah_rag_chunks;`
- Check embeddings exist: `SELECT id FROM waratah_rag_chunks WHERE embedding IS NOT NULL LIMIT 10;`
- Run RAG ingestion if tables are empty

### Recipe sync fails
- Verify `RECIPE_SYNC_SECRET` matches in .env and Airtable automation
- Check Airtable base ID: `wspB1DzuXWuxEAhCD`
- Check webhook endpoint is accessible

### API returns 500 errors
- Check Supabase connection: Verify `NEXT_PUBLIC_SUPABASE_URL` and keys
- Check function names: Ensure `waratah_match_chunks` and `waratah_hybrid_search` exist
- Check logs: `npm run dev` shows detailed errors

---

## Support

For issues specific to Waratah deployment, check:
1. [../DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md) - Deployment steps
2. [../CLAUDE.md](../CLAUDE.md) - System architecture
3. Supabase Dashboard → SQL Editor → Run test queries

---

**Deployment Date:** 2026-02-12
**Status:** ✅ Ready for RAG ingestion and testing
**Next:** Ingest knowledge base documents and test search functionality
