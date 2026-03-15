import { getLatestPrepRun, getStocktakeStatus } from '@/lib/airtable';

export const runtime = 'nodejs';

const WARATAH_BASE_ID = process.env.WARATAH_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';

export async function GET() {
  try {
    const [prepRun, stocktake] = await Promise.all([
      getLatestPrepRun(WARATAH_BASE_ID),
      getStocktakeStatus(WARATAH_BASE_ID),
    ]);

    return Response.json({
      prepRun,
      stocktake: {
        coveragePercent: stocktake.coveragePercent,
        countedItems: stocktake.countedItems,
        totalItems: stocktake.totalItems,
        isReady: stocktake.isReadyForFinalization,
      },
    });
  } catch (error) {
    console.error('Prep status error:', error);
    return Response.json(
      { error: 'Failed to fetch prep status' },
      { status: 500 }
    );
  }
}
