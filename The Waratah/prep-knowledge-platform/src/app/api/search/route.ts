/**
 * Knowledge Base Search API
 * Phase 7: Enhanced with caching, hybrid search, and analytics
 */

import { smartSearch, type SearchResult } from '@/lib/search';

export const runtime = 'nodejs';

interface SearchRequest {
  query: string;
  limit?: number;
  category?: string;
  searchType?: 'vector' | 'hybrid' | 'smart';
}

export async function POST(req: Request) {
  try {
    const { query, limit = 5, category, searchType = 'smart' } = (await req.json()) as SearchRequest;

    if (!query || query.trim().length === 0) {
      return Response.json({ sources: [], error: 'Query is required' }, { status: 400 });
    }

    // Use the enhanced search library
    const { results, searchId, cached, strategy } = await smartSearch(query, {
      limit,
      category,
      searchType: searchType === 'smart' ? undefined : searchType,
      useCache: true,
      trackAnalytics: true,
    });

    // Format for client
    const formattedSources = results.map((s: SearchResult) => ({
      id: s.id,
      filename: s.metadata.filename || s.metadata.title || 'Unknown',
      category: s.metadata.category || 'General',
      chunk: s.content.slice(0, 200) + (s.content.length > 200 ? '...' : ''),
      similarity: s.similarity,
      combinedScore: s.combinedScore,
    }));

    return Response.json({
      sources: formattedSources,
      meta: {
        searchId,
        cached,
        strategy,
        resultCount: results.length,
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return Response.json(
      { sources: [], error: 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}
