/**
 * Batching Lists API
 * GET /api/prep/lists/batching
 *
 * Returns batch tasks with recipe ingredients scaled by batch count.
 * Shows what needs to be made for the current prep run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableBaseIdFromRequest } from '@/lib/api-venue';
import { getLatestPrepRun } from '@/lib/prep/prep-run';
import { buildBatchingList } from '@/lib/prep/batching-list';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'AIRTABLE_PAT not configured' },
        { status: 500 }
      );
    }

    // Extract venue-specific base ID from request
    const baseId = getAirtableBaseIdFromRequest(request);

    // Get latest prep run for context
    const prepRun = await getLatestPrepRun(baseId);
    const prepRunId = prepRun?.id;
    const taskIds = (prepRun?.fields['Prep Tasks'] as string[]) || [];

    // Build batching list
    const result = await buildBatchingList(baseId, prepRunId, taskIds);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Batching list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch batching list' },
      { status: 500 }
    );
  }
}
