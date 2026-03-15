/**
 * Prep Workflow Generation API
 *
 * POST /api/prep/workflow/generate
 *
 * Executes the full prep workflow:
 * 1. Finalize stocktake (verify and confirm counts)
 * 2. Generate prep run (calculate shortfalls, create tasks, BOM explosion)
 *
 * Returns: Workflow results with status for each step
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableBaseIdFromRequest } from '@/lib/api-venue';
import { finalizeStocktake } from '@/lib/workflow/finalize-stocktake';
import { generatePrepRun } from '@/lib/workflow/generate-prep-run';
import { WorkflowResult } from '@/lib/workflow/types';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.AIRTABLE_PAT) {
      return NextResponse.json(
        { error: 'AIRTABLE_PAT not configured' },
        { status: 500 }
      );
    }

    // Extract venue-specific base ID from request
    const baseId = getAirtableBaseIdFromRequest(request);

    const results: WorkflowResult[] = [];

    // Step 1: Finalize Stocktake
    console.log('Step 1: Finalizing stocktake...');
    const finalizeResult = await finalizeStocktake(baseId);
    results.push(finalizeResult);

    if (finalizeResult.status === 'error') {
      return NextResponse.json(
        { success: false, results },
        { status: 400 }
      );
    }

    // Step 2: Generate Prep Run
    console.log('Step 2: Generating prep run...');
    const generateResult = await generatePrepRun(baseId);
    results.push(generateResult);

    if (generateResult.status === 'error') {
      return NextResponse.json(
        { success: false, results },
        { status: 400 }
      );
    }

    // Success - both steps completed
    return NextResponse.json({
      success: true,
      results,
      message: 'Workflow completed successfully',
    });

  } catch (error) {
    console.error('Workflow generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute workflow',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
