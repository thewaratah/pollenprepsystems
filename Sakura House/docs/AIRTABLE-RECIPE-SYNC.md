# Airtable Recipe Sync Automation

Automatically sync recipe changes from Airtable to the RAG knowledge base.

## Overview

When a recipe is created or updated in Airtable, an automation triggers a webhook that:
1. Fetches the full recipe details (ingredients, method, yield)
2. Converts to searchable text format
3. Generates embeddings via OpenAI
4. Upserts to Supabase RAG database

## Setup Instructions

### 1. Deploy the Knowledge Platform

Ensure the Next.js app is deployed and accessible:
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### 2. Configure Environment Variable

Add to your deployment environment:
```
RECIPE_SYNC_SECRET=7cb2563dfff6bd70c79c6d80d23d5999571987887e3ccdd8
```

### 3. Create Airtable Automation

1. Open Airtable base: `appNsFRhuU47e9qlR`
2. Go to **Automations** tab
3. Click **Create automation**

#### Trigger: When record updated

- **Table:** Recipes
- **Watch fields:** Item Name, Yield Qty, Method
- **Condition:** When any watched field changes

#### Action: Run script

```javascript
// Airtable Automation Script: Sync Recipe to RAG

const config = input.config();
const record = config.record;

// Your deployment URL
const WEBHOOK_URL = 'https://your-domain.com/api/sync/recipe';
const SYNC_SECRET = '7cb2563dfff6bd70c79c6d80d23d5999571987887e3ccdd8';

// Get the recipe name from linked Item
const itemTable = base.getTable('Items');
const itemId = record.getCellValue('Item Name')?.[0]?.id;

let recipeName = 'Unknown Recipe';
if (itemId) {
    const itemRecord = await itemTable.selectRecordAsync(itemId);
    recipeName = itemRecord.getCellValueAsString('Item Name');
}

// Call the webhook
const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': SYNC_SECRET,
    },
    body: JSON.stringify({
        recipeId: record.id,
        recipeName: recipeName,
        action: 'update',
    }),
});

const result = await response.json();
console.log('Sync result:', result);

if (!result.success) {
    throw new Error(result.error || 'Sync failed');
}

output.set('synced', true);
output.set('chunks', result.chunks);
```

### 4. Create Second Automation for New Recipes

Duplicate the automation above with:
- **Trigger:** When record created
- **Action:** Same script but with `action: 'create'`

### 5. Test the Integration

#### Manual Test via curl:
```bash
curl -X POST https://your-domain.com/api/sync/recipe \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: 7cb2563dfff6bd70c79c6d80d23d5999571987887e3ccdd8" \
  -d '{"recipeName": "Wasabi Mayo", "action": "sync"}'
```

#### Sync All Recipes:
```bash
curl "https://your-domain.com/api/sync/recipe?all=true&secret=7cb2563dfff6bd70c79c6d80d23d5999571987887e3ccdd8"
```

## API Reference

### POST /api/sync/recipe

Sync a single recipe to RAG.

**Headers:**
- `x-sync-secret`: Authentication secret

**Body:**
```json
{
  "recipeId": "recXXXXXX",      // Airtable record ID
  "recipeName": "Wasabi Mayo",   // Or recipe name (optional if recipeId provided)
  "action": "create" | "update" | "delete" | "sync"
}
```

**Response:**
```json
{
  "success": true,
  "action": "update",
  "recipe": {
    "id": "recXXXXXX",
    "name": "Wasabi Mayo",
    "ingredients": 5
  },
  "chunks": 2
}
```

### GET /api/sync/recipe?all=true&secret=XXX

Sync all recipes from Airtable to RAG.

**Response:**
```json
{
  "success": true,
  "results": {
    "total": 45,
    "synced": 44,
    "failed": 1,
    "errors": ["Recipe X: Error message"]
  }
}
```

## Troubleshooting

### Automation not triggering
- Check that watched fields include all relevant recipe fields
- Verify automation is turned ON
- Check Airtable automation run history for errors

### Webhook returns 401 Unauthorized
- Verify `RECIPE_SYNC_SECRET` matches in both Airtable script and .env.local
- Ensure header is `x-sync-secret` (lowercase)

### Recipe not found
- Check the Item Name field is properly linked in Recipes table
- Verify the Item exists and has a name

### Embeddings failing
- Check OpenAI API key is valid
- Verify OpenAI has available credits

## Monitoring

Check sync status in Supabase:
```sql
-- Recent recipe documents
SELECT file_name, status, processed_at, chunk_count
FROM rag_documents
WHERE file_type = 'recipe'
ORDER BY processed_at DESC
LIMIT 10;

-- Recipe chunk count
SELECT COUNT(*) as total_chunks
FROM rag_chunks c
JOIN rag_documents d ON c.document_id = d.id
WHERE d.file_type = 'recipe';
```

---

*Phase 6: Airtable Sync Automation - Complete*
