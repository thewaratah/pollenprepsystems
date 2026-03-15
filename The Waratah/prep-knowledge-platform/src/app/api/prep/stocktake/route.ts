import { getStocktakeStatus } from '@/lib/airtable';

export const runtime = 'nodejs';

const WARATAH_BASE_ID = process.env.WARATAH_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';

export async function GET() {
  try {
    const status = await getStocktakeStatus(WARATAH_BASE_ID);
    return Response.json(status);
  } catch (error) {
    console.error('Stocktake status error:', error);
    return Response.json(
      { error: 'Failed to fetch stocktake status' },
      { status: 500 }
    );
  }
}
