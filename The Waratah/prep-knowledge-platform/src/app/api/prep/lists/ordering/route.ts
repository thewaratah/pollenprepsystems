/**
 * Ordering Lists API
 * GET /api/prep/lists/ordering?staff=andie|blade
 *
 * Returns ingredient requirements grouped by supplier for ordering staff.
 * Filters by staff member (andie/blade) if specified.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableBaseIdFromRequest } from '@/lib/api-venue';
import { getLatestPrepRun } from '@/lib/prep/prep-run';
import { buildOrderingList } from '@/lib/prep/ordering-list';

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

    // Get staff filter from query parameter
    const staffFilter = request.nextUrl.searchParams.get('staff');

    // Get latest prep run for context
    const prepRun = await getLatestPrepRun(baseId);
    const prepRunId = prepRun?.id;
    const reqIds = (prepRun?.fields['Ingredient Requirements'] as string[]) || [];

    // Build ordering list
    const result = await buildOrderingList(baseId, prepRunId, reqIds, staffFilter);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ordering list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ordering list' },
      { status: 500 }
    );
  }
}
