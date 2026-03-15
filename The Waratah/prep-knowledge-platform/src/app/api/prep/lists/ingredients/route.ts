/**
 * Ingredient Prep Lists API
 * GET /api/prep/lists/ingredients
 *
 * Returns ingredient prep list showing Batches → Sub-Recipes → Ingredients.
 * Shows what sub-recipes need to be made for each batch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableBaseIdFromRequest } from '@/lib/api-venue';
import { getLatestPrepRun } from '@/lib/prep/prep-run';
import { buildIngredientsListResult } from '@/lib/prep/ingredients-list';

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

    // Build ingredient prep list
    const result = await buildIngredientsListResult(baseId, prepRunId, taskIds);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ingredient prep list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ingredient prep list' },
      { status: 500 }
    );
  }
}
