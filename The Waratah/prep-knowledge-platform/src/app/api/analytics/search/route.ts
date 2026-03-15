/**
 * Search Analytics API
 * Phase 7: Monitoring and optimization insights
 */

import { NextResponse } from 'next/server';
import { getSearchStats, getCacheStats, clearSearchCache } from '@/lib/search';

export const runtime = 'nodejs';

/**
 * GET /api/analytics/search
 * Returns search performance metrics and popular queries
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);

    const [searchStats, cacheStats] = await Promise.all([
      getSearchStats(days),
      Promise.resolve(getCacheStats()),
    ]);

    return NextResponse.json({
      period: `${days} days`,
      searches: {
        total: searchStats.totalSearches,
        avgLatencyMs: Math.round(searchStats.avgLatency),
        avgTopSimilarity: Math.round(searchStats.avgSimilarity * 100) / 100,
      },
      cache: {
        entriesCount: cacheStats.size,
        hitRate: 'N/A', // Would need request-level tracking
      },
      topQueries: searchStats.topQueries.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/search
 * Actions: clear cache, record feedback
 */
export async function POST(req: Request) {
  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'clear_cache':
        clearSearchCache();
        return NextResponse.json({
          success: true,
          message: 'Search cache cleared',
        });

      case 'record_feedback':
        const { searchId, chunkId, feedbackType } = params;
        if (!searchId || !chunkId || !feedbackType) {
          return NextResponse.json(
            { error: 'Missing required parameters' },
            { status: 400 }
          );
        }

        const { recordSearchFeedback } = await import('@/lib/search');
        await recordSearchFeedback(searchId, chunkId, feedbackType);

        return NextResponse.json({
          success: true,
          message: 'Feedback recorded',
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Analytics action error:', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}
