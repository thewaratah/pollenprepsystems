/**
 * Waratah Multi-Table Sync Endpoint
 * Syncs multiple Airtable tables to Waratah RAG:
 * - Recipe Database
 * - Ingredient Templates
 * - Prep Theory
 * - Equipment Overview
 *
 * POST /api/sync/airtable
 * Body: { table: string, recordId?: string, action: 'sync' | 'sync_all' }
 * Headers: x-sync-secret: <RECIPE_SYNC_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import Airtable from 'airtable';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large table syncs

const SYNC_SECRET = process.env.RECIPE_SYNC_SECRET || 'dev-secret-change-me';
const CHUNK_SIZE = 800;
// RAG tables are in a separate base from operational PREP system
const WARATAH_RAG_BASE_ID = process.env.WARATAH_RAG_BASE_ID || 'appItKHSfH9ObETUO';
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

// Table configurations - using actual table names from appItKHSfH9ObETUO
const TABLE_CONFIGS = {
  'Ingredient Templates': {
    category: 'Ingredients',
    fields: ['Item Name', 'Description', 'Storage', 'Shelf Life', 'Supplier'],
  },
  'Theory': {
    category: 'Theory',
    fields: ['Title', 'Content', 'Category', 'Tags'],
  },
  'Equipment': {
    category: 'Equipment',
    fields: ['Name', 'Description', 'Usage', 'Maintenance', 'Location'],
  },
  'Ingredient Database': {
    category: 'Ingredients',
    fields: ['Name', 'Name 2.0', 'Type', 'Classification', 'Supplier'],
  },
};

interface SyncRequest {
  table: string;
  recordId?: string;
  action: 'sync' | 'sync_all';
  maxRecords?: number; // Limit number of records to sync
}

/**
 * Convert Airtable record to searchable text
 */
function recordToText(table: string, record: any): string {
  const parts: string[] = [];
  const config = TABLE_CONFIGS[table as keyof typeof TABLE_CONFIGS];

  if (!config) {
    throw new Error(`Unknown table: ${table}`);
  }

  switch (table) {
    case 'Ingredient Templates':
      parts.push(`# ${record.fields['Item Name']}`);
      parts.push('');
      if (record.fields['Description']) {
        parts.push(record.fields['Description']);
        parts.push('');
      }
      if (record.fields['Storage']) {
        parts.push(`**Storage:** ${record.fields['Storage']}`);
      }
      if (record.fields['Shelf Life']) {
        parts.push(`**Shelf Life:** ${record.fields['Shelf Life']}`);
      }
      if (record.fields['Supplier']) {
        parts.push(`**Supplier:** ${record.fields['Supplier']}`);
      }
      break;

    case 'Theory':
      parts.push(`# ${record.fields['Title']}`);
      parts.push('');
      if (record.fields['Category']) {
        parts.push(`**Category:** ${record.fields['Category']}`);
      }
      if (record.fields['Tags']) {
        parts.push(`**Tags:** ${record.fields['Tags']}`);
      }
      parts.push('');
      if (record.fields['Content']) {
        parts.push(record.fields['Content']);
      }
      break;

    case 'Equipment':
      parts.push(`# ${record.fields['Name']}`);
      parts.push('');
      if (record.fields['Description']) {
        parts.push(record.fields['Description']);
        parts.push('');
      }
      if (record.fields['Usage']) {
        parts.push('## Usage');
        parts.push(record.fields['Usage']);
        parts.push('');
      }
      if (record.fields['Maintenance']) {
        parts.push('## Maintenance');
        parts.push(record.fields['Maintenance']);
        parts.push('');
      }
      if (record.fields['Location']) {
        parts.push(`**Location:** ${record.fields['Location']}`);
      }
      break;

    case 'Ingredient Database':
      parts.push(`# ${record.fields['Name 2.0'] || record.fields['Name']}`);
      parts.push('');
      if (record.fields['Type']) {
        const types = Array.isArray(record.fields['Type'])
          ? record.fields['Type'].join(', ')
          : record.fields['Type'];
        parts.push(`**Type:** ${types}`);
      }
      if (record.fields['Classification']) {
        const classifications = Array.isArray(record.fields['Classification'])
          ? record.fields['Classification'].join(', ')
          : record.fields['Classification'];
        parts.push(`**Classification:** ${classifications}`);
      }
      if (record.fields['Supplier']) {
        const suppliers = Array.isArray(record.fields['Supplier'])
          ? record.fields['Supplier'].join(', ')
          : record.fields['Supplier'];
        parts.push(`**Supplier:** ${suppliers}`);
      }
      break;
  }

  parts.push('');
  parts.push(`**Source:** ${table}`);
  parts.push(`**Category:** ${config.category}`);

  return parts.join('\n');
}

/**
 * Chunk text into smaller pieces
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
 * Upsert record into Waratah RAG
 */
async function upsertRecordToRAG(
  table: string,
  record: any
): Promise<{ chunks: number }> {
  const supabase = createServerClient();
  const config = TABLE_CONFIGS[table as keyof typeof TABLE_CONFIGS];

  if (!config) {
    throw new Error(`Unknown table: ${table}`);
  }

  const fileHash = `${table.toLowerCase().replace(/\s+/g, '-')}-${record.id}`;
  const fileName = `${record.fields[config.fields[0]] || record.id}.txt`;

  // Delete existing document and chunks
  const { data: existingDoc } = await supabase
    .from('waratah_rag_documents')
    .select('id')
    .eq('id', fileHash)
    .single();

  if (existingDoc) {
    await supabase.from('waratah_rag_chunks').delete().eq('document_id', existingDoc.id);
    await supabase.from('waratah_rag_documents').delete().eq('id', existingDoc.id);
  }

  // Convert to text
  const text = recordToText(table, record);
  const chunks = chunkText(text);

  // Create document
  const { data: doc, error: docError } = await supabase
    .from('waratah_rag_documents')
    .insert({
      id: fileHash,
      title: record.fields[config.fields[0]] || fileName,
      category: config.category,
      source: `Airtable: ${table}`,
      total_chunks: chunks.length,
    })
    .select('id')
    .single();

  if (docError) {
    throw new Error(`Failed to create document: ${docError.message}`);
  }

  // Generate embeddings and create chunks
  const chunkRecords = await Promise.all(
    chunks.map(async (content, idx) => {
      const embedding = await generateEmbedding(content);
      return {
        id: `${fileHash}-chunk-${idx}`,
        document_id: doc.id,
        chunk_index: idx,
        content,
        embedding,
      };
    })
  );

  const { error: chunkError } = await supabase
    .from('waratah_rag_chunks')
    .insert(chunkRecords);

  if (chunkError) {
    throw new Error(`Failed to create chunks: ${chunkError.message}`);
  }

  return { chunks: chunks.length };
}

/**
 * Sync all records from a table
 */
async function syncAllRecords(table: string, maxRecords = 1000): Promise<{ synced: number; errors: number }> {
  if (!AIRTABLE_PAT) {
    throw new Error('AIRTABLE_PAT not configured');
  }

  const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(WARATAH_RAG_BASE_ID);
  const records: any[] = [];

  // Fetch all records (or limited number)
  await base(table)
    .select({ maxRecords })
    .eachPage((pageRecords, fetchNextPage) => {
      records.push(...pageRecords);
      fetchNextPage();
    });

  let synced = 0;
  let errors = 0;

  for (const record of records) {
    try {
      await upsertRecordToRAG(table, record);
      synced++;
    } catch (error) {
      console.error(`Failed to sync record ${record.id}:`, error);
      errors++;
    }
  }

  return { synced, errors };
}

/**
 * POST handler
 */
export async function POST(req: NextRequest) {
  try {
    // Verify secret
    const secret = req.headers.get('x-sync-secret');
    if (secret !== SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SyncRequest;
    const { table, recordId, action, maxRecords } = body;

    if (!table || !TABLE_CONFIGS[table as keyof typeof TABLE_CONFIGS]) {
      return NextResponse.json(
        { error: `Invalid table. Must be one of: ${Object.keys(TABLE_CONFIGS).join(', ')}` },
        { status: 400 }
      );
    }

    if (action === 'sync_all') {
      // Sync all records from table (or limited number)
      const result = await syncAllRecords(table, maxRecords);
      return NextResponse.json({
        success: true,
        table,
        action: 'sync_all',
        synced: result.synced,
        errors: result.errors,
      });
    } else {
      // Sync single record
      if (!recordId) {
        return NextResponse.json(
          { error: 'recordId required for sync action' },
          { status: 400 }
        );
      }

      if (!AIRTABLE_PAT) {
        throw new Error('AIRTABLE_PAT not configured');
      }

      const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(WARATAH_RAG_BASE_ID);
      const record = await base(table).find(recordId);

      const result = await upsertRecordToRAG(table, record);

      return NextResponse.json({
        success: true,
        table,
        recordId,
        action: 'sync',
        chunks: result.chunks,
      });
    }
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for bulk sync
 */
export async function GET(req: NextRequest) {
  try {
    // Verify secret
    const secret = req.headers.get('x-sync-secret');
    if (secret !== SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table');
    const maxRecords = searchParams.get('maxRecords')
      ? parseInt(searchParams.get('maxRecords')!, 10)
      : undefined;

    if (table && TABLE_CONFIGS[table as keyof typeof TABLE_CONFIGS]) {
      // Sync specific table (with optional record limit)
      const result = await syncAllRecords(table, maxRecords);
      return NextResponse.json({
        success: true,
        table,
        synced: result.synced,
        errors: result.errors,
      });
    } else {
      // Sync all tables
      const results: Record<string, any> = {};

      for (const tableName of Object.keys(TABLE_CONFIGS)) {
        try {
          const result = await syncAllRecords(tableName);
          results[tableName] = result;
        } catch (error) {
          results[tableName] = {
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      return NextResponse.json({
        success: true,
        action: 'sync_all_tables',
        results,
      });
    }
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
