/**
 * Recipe Sync Webhook
 * Receives recipe updates from Airtable automation and ingests into RAG
 *
 * Airtable Automation Setup:
 * 1. Trigger: "When record created" or "When record updated" on Recipes table
 * 2. Action: "Run script" with webhook call to this endpoint
 *
 * POST /api/sync/recipe
 * Body: { recipeId: string, action: 'create' | 'update' | 'delete' }
 * Headers: x-sync-secret: <RECIPE_SYNC_SECRET>
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { lookupRecipe, type Recipe } from '@/lib/airtable';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYNC_SECRET = process.env.RECIPE_SYNC_SECRET || 'dev-secret-change-me';
const WARATAH_BASE_ID = process.env.WARATAH_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
const CHUNK_SIZE = 800; // Smaller chunks for recipes

interface SyncRequest {
  recipeId?: string;
  recipeName?: string;
  action: 'create' | 'update' | 'delete' | 'sync';
}

/**
 * Convert a recipe to searchable text format
 */
function recipeToText(recipe: Recipe): string {
  const parts: string[] = [];

  // Title and yield
  parts.push(`# ${recipe.name}`);
  parts.push(`Yield: ${recipe.yield} ${recipe.yieldUnit}`);
  parts.push('');

  // Ingredients section
  parts.push('## Ingredients');
  for (const ing of recipe.ingredients) {
    const qty = ing.quantity ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}` : '';
    parts.push(`- ${ing.name}${qty ? ': ' + qty : ''}`);
  }
  parts.push('');

  // Method section
  if (recipe.method) {
    parts.push('## Method');
    parts.push(recipe.method);
  }

  // Metadata for search
  parts.push('');
  parts.push(`Category: House Recipe`);
  parts.push(`Type: Recipe`);
  parts.push(`Ingredient count: ${recipe.ingredients.length}`);

  return parts.join('\n');
}

/**
 * Split text into chunks for embedding
 */
function chunkText(text: string, maxLength: number = CHUNK_SIZE): string[] {
  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Upsert recipe document into RAG database
 */
async function upsertRecipeToRAG(recipe: Recipe): Promise<{ chunks: number }> {
  const supabase = createServerClient();

  // Generate document ID from recipe ID (consistent for updates)
  const fileHash = `recipe-${recipe.id}`;
  const fileName = `${recipe.name}.recipe`;

  // Check if document exists
  const { data: existingDoc } = await supabase
    .from('waratah_rag_documents')
    .select('id')
    .eq('file_hash', fileHash)
    .single();

  // Delete existing chunks if updating
  if (existingDoc) {
    await supabase.from('waratah_rag_chunks').delete().eq('document_id', existingDoc.id);
    await supabase.from('waratah_rag_documents').delete().eq('id', existingDoc.id);
  }

  // Convert recipe to text
  const text = recipeToText(recipe);
  const chunks = chunkText(text);

  // Get KB-01 category ID (House Recipes)
  const { data: category } = await supabase
    .from('waratah_rag_categories')
    .select('id')
    .eq('code', 'KB-01')
    .single();

  const categoryId = category?.id || null;

  // Insert document
  const { data: newDoc, error: docError } = await supabase
    .from('waratah_rag_documents')
    .insert({
      file_name: fileName,
      file_path: `airtable://recipes/${recipe.id}`,
      file_type: 'recipe',
      file_size_bytes: text.length,
      file_hash: fileHash,
      title: recipe.name,
      category_id: categoryId,
      status: 'processing',
    })
    .select('id')
    .single();

  if (docError || !newDoc) {
    throw new Error(`Failed to insert document: ${docError?.message}`);
  }

  // Generate embeddings and insert chunks
  const chunkRecords = [];
  let totalTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await generateEmbedding(content);
    const tokenCount = Math.ceil(content.length / 4); // Rough estimate

    chunkRecords.push({
      document_id: newDoc.id,
      content,
      chunk_index: i,
      token_count: tokenCount,
      embedding,
      metadata: {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        category: 'House Recipes',
      },
    });

    totalTokens += tokenCount;
  }

  // Insert chunks in batch
  const { error: chunkError } = await supabase.from('waratah_rag_chunks').insert(chunkRecords);

  if (chunkError) {
    throw new Error(`Failed to insert chunks: ${chunkError.message}`);
  }

  // Update document status
  await supabase
    .from('waratah_rag_documents')
    .update({
      status: 'completed',
      chunk_count: chunks.length,
      total_tokens: totalTokens,
      processed_at: new Date().toISOString(),
    })
    .eq('id', newDoc.id);

  return { chunks: chunks.length };
}

/**
 * Delete recipe from RAG database
 */
async function deleteRecipeFromRAG(recipeId: string): Promise<boolean> {
  const supabase = createServerClient();
  const fileHash = `recipe-${recipeId}`;

  const { data: doc } = await supabase
    .from('waratah_rag_documents')
    .select('id')
    .eq('file_hash', fileHash)
    .single();

  if (doc) {
    await supabase.from('waratah_rag_chunks').delete().eq('document_id', doc.id);
    await supabase.from('waratah_rag_documents').delete().eq('id', doc.id);
    return true;
  }

  return false;
}

export async function POST(req: Request) {
  try {
    // Verify secret
    const authHeader = req.headers.get('x-sync-secret');
    if (authHeader !== SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SyncRequest;
    const { recipeId, recipeName, action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    // Handle delete
    if (action === 'delete') {
      if (!recipeId) {
        return NextResponse.json({ error: 'Missing recipeId for delete' }, { status: 400 });
      }
      const deleted = await deleteRecipeFromRAG(recipeId);
      return NextResponse.json({
        success: true,
        action: 'delete',
        deleted,
      });
    }

    // For create/update/sync, we need to fetch the recipe
    const searchTerm = recipeName || recipeId;
    if (!searchTerm) {
      return NextResponse.json({ error: 'Missing recipeId or recipeName' }, { status: 400 });
    }

    const recipe = await lookupRecipe(WARATAH_BASE_ID, searchTerm);
    if (!recipe) {
      return NextResponse.json({ error: `Recipe not found: ${searchTerm}` }, { status: 404 });
    }

    // Upsert to RAG
    const result = await upsertRecipeToRAG(recipe);

    return NextResponse.json({
      success: true,
      action,
      recipe: {
        id: recipe.id,
        name: recipe.name,
        ingredients: recipe.ingredients.length,
      },
      chunks: result.chunks,
    });
  } catch (error) {
    console.error('Recipe sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Sync all recipes (manual trigger)
 * GET /api/sync/recipe?all=true
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const syncAll = url.searchParams.get('all') === 'true';
  const secret = url.searchParams.get('secret');

  if (secret !== SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!syncAll) {
    return NextResponse.json({
      message: 'Recipe Sync API',
      endpoints: {
        'POST /api/sync/recipe': 'Sync single recipe',
        'GET /api/sync/recipe?all=true&secret=<secret>': 'Sync all recipes',
      },
    });
  }

  // Import listRecipes to get all recipes
  const { listRecipes } = await import('@/lib/airtable');
  const recipes = await listRecipes(WARATAH_BASE_ID);

  const results = {
    total: recipes.length,
    synced: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const { name } of recipes) {
    try {
      const recipe = await lookupRecipe(WARATAH_BASE_ID, name);
      if (recipe) {
        await upsertRecipeToRAG(recipe);
        results.synced++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({
    success: true,
    results,
  });
}
