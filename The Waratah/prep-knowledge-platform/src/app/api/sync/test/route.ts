/**
 * Diagnostic endpoint to test Airtable connection
 */

import { NextResponse } from 'next/server';
import Airtable from 'airtable';

export const runtime = 'nodejs';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const WARATAH_RAG_BASE_ID = process.env.WARATAH_RAG_BASE_ID || 'appItKHSfH9ObETUO';

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    env_check: {
      AIRTABLE_PAT_set: !!AIRTABLE_PAT,
      AIRTABLE_PAT_length: AIRTABLE_PAT?.length || 0,
      WARATAH_RAG_BASE_ID: WARATAH_RAG_BASE_ID,
      WARATAH_RAG_BASE_ID_set: !!WARATAH_RAG_BASE_ID,
    },
    connection_test: {} as any,
  };

  // Test Airtable connection
  try {
    if (!AIRTABLE_PAT) {
      throw new Error('AIRTABLE_PAT not configured');
    }

    const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(WARATAH_RAG_BASE_ID);

    // Try to fetch 1 record from Ingredient Templates
    const records: any[] = [];
    await base('Ingredient Templates')
      .select({ maxRecords: 1 })
      .eachPage((pageRecords, fetchNextPage) => {
        records.push(...pageRecords);
        fetchNextPage();
      });

    diagnostics.connection_test = {
      success: true,
      records_found: records.length,
      sample_record_id: records[0]?.id || null,
      sample_record_fields: records[0]?.fields ? Object.keys(records[0].fields) : [],
    };
  } catch (error) {
    diagnostics.connection_test = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    };
  }

  return NextResponse.json(diagnostics);
}
