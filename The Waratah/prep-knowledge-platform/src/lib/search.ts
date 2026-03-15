/**
 * Phase 7: Enhanced Search with Caching & Hybrid Search
 * Phase 8: Venue-aware search for multi-tenant RAG
 */

import { createServerClient } from './supabase';
import { generateEmbedding } from './openai';
import { getCurrentVenue } from './venues';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  textRank?: number;
  combinedScore?: number;
  metadata: {
    filename?: string;
    title?: string;
    category?: string;
    document_id?: string;
    chunk_index?: number;
  };
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  category?: string;
  searchType?: 'vector' | 'hybrid' | 'text';
  vectorWeight?: number;
  textWeight?: number;
  useCache?: boolean;
  trackAnalytics?: boolean;
  venuePrefix?: string; // Optional venue override
}

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  searchId?: string;
}

// ============================================
// In-Memory Cache (15-minute TTL)
// ============================================

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const searchCache = new Map<string, CacheEntry>();

function getCacheKey(query: string, options: SearchOptions): string {
  const normalized = {
    query: query.toLowerCase().trim(),
    limit: options.limit || 10,
    threshold: options.threshold || 0.5,
    category: options.category || 'all',
    searchType: options.searchType || 'vector',
  };
  return crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex');
}

function getFromCache(key: string): CacheEntry | null {
  const entry = searchCache.get(key);
  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }

  return entry;
}

function setCache(key: string, results: SearchResult[], searchId?: string): void {
  // Clean old entries periodically
  if (searchCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        searchCache.delete(k);
      }
    }
  }

  searchCache.set(key, {
    results,
    timestamp: Date.now(),
    searchId,
  });
}

// ============================================
// Search Functions
// ============================================

/**
 * Standard vector similarity search
 */
export async function vectorSearch(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; searchId?: string; cached: boolean }> {
  const {
    limit = 10,
    threshold = 0.5,
    category,
    useCache = true,
    trackAnalytics = true,
  } = options;

  // Check cache
  const cacheKey = getCacheKey(query, { ...options, searchType: 'vector' });
  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { results: cached.results, searchId: cached.searchId, cached: true };
    }
  }

  const supabase = createServerClient();
  const queryEmbedding = await generateEmbedding(query);

  let results: SearchResult[];
  let searchId: string | undefined;

  // Use Waratah-specific vector search function
  const { data, error } = await supabase.rpc('waratah_match_chunks', {
    query_embedding: queryEmbedding,
    match_count: limit,
    match_threshold: threshold,
  });

  if (error) throw new Error(`Search failed: ${error.message}`);

  results = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    content: row.content as string,
    similarity: row.similarity as number,
    metadata: {
      document_id: row.document_id as string,
    } as SearchResult['metadata'],
  }));

  // Log analytics separately if enabled
  if (trackAnalytics && results.length > 0) {
    const { data: analyticsData } = await supabase
      .from('waratah_search_analytics')
      .insert({
        query: query,
        strategy: 'vector',
        results_count: results.length,
        top_similarity: results[0]?.similarity || 0,
      })
      .select('id')
      .single();

    searchId = analyticsData?.id?.toString();
  }

  // Apply category filter
  if (category && category !== 'all') {
    results = results.filter(
      (r) => r.metadata.category?.toLowerCase() === category.toLowerCase()
    );
  }

  // Cache results
  if (useCache) {
    setCache(cacheKey, results, searchId);
  }

  return { results, searchId, cached: false };
}

/**
 * Hybrid search combining vector similarity and full-text search
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; searchId?: string; cached: boolean }> {
  const {
    limit = 10,
    threshold = 0.5,
    vectorWeight = 0.7,
    textWeight = 0.3,
    category,
    useCache = true,
    trackAnalytics = true,
  } = options;

  // Check cache
  const cacheKey = getCacheKey(query, { ...options, searchType: 'hybrid' });
  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { results: cached.results, searchId: cached.searchId, cached: true };
    }
  }

  const supabase = createServerClient();
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('waratah_hybrid_search', {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: limit,
    match_threshold: threshold,
    vector_weight: vectorWeight,
    text_weight: textWeight,
  });

  if (error) throw new Error(`Hybrid search failed: ${error.message}`);

  let results: SearchResult[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    content: row.content as string,
    similarity: row.similarity as number,
    textRank: row.text_rank as number,
    combinedScore: row.combined_score as number,
    metadata: (row.metadata || {}) as SearchResult['metadata'],
  }));

  // Apply category filter
  if (category && category !== 'all') {
    results = results.filter(
      (r) => r.metadata.category?.toLowerCase() === category.toLowerCase()
    );
  }

  // Log analytics if enabled
  let searchId: string | undefined;
  if (trackAnalytics && results.length > 0) {
    const { data: analyticsData } = await supabase
      .from('waratah_search_analytics')
      .insert({
        query: query,
        strategy: 'hybrid',
        results_count: results.length,
        top_similarity: results[0]?.similarity || 0,
      })
      .select('id')
      .single();

    searchId = analyticsData?.id?.toString();
  }

  // Cache results
  if (useCache) {
    setCache(cacheKey, results, searchId);
  }

  return { results, searchId, cached: false };
}

/**
 * Smart search that chooses the best strategy
 */
export async function smartSearch(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; searchId?: string; cached: boolean; strategy: string }> {
  // Use hybrid search for longer queries (more context for text matching)
  // Use vector search for short queries (semantic similarity matters more)
  const wordCount = query.trim().split(/\s+/).length;
  const strategy = wordCount >= 4 ? 'hybrid' : 'vector';

  if (strategy === 'hybrid') {
    const result = await hybridSearch(query, options);
    return { ...result, strategy };
  } else {
    const result = await vectorSearch(query, options);
    return { ...result, strategy };
  }
}

// ============================================
// Feedback Tracking
// ============================================

export async function recordSearchFeedback(
  searchId: string,
  chunkId: string,
  feedbackType: 'helpful' | 'not_helpful' | 'clicked'
): Promise<void> {
  const supabase = createServerClient();

  // Note: waratah_search_feedback table not yet created
  // Skip feedback logging for now
  console.log('Search feedback:', { searchId, chunkId, feedbackType });
}

// ============================================
// Analytics
// ============================================

export async function getSearchStats(days: number = 7): Promise<{
  totalSearches: number;
  avgLatency: number;
  avgSimilarity: number;
  topQueries: Array<{ query: string; count: number }>;
}> {
  const supabase = createServerClient();

  const { data: stats } = await supabase
    .from('waratah_search_analytics')
    .select('latency_ms, top_similarity')
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  const searches = stats || [];

  return {
    totalSearches: searches.length,
    avgLatency: searches.length > 0
      ? searches.reduce((sum, s) => sum + (s.latency_ms || 0), 0) / searches.length
      : 0,
    avgSimilarity: searches.length > 0
      ? searches.reduce((sum, s) => sum + (s.top_similarity || 0), 0) / searches.length
      : 0,
    topQueries: [], // No popular_queries view for Waratah yet
  };
}

/**
 * Clear the search cache
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: searchCache.size,
    keys: Array.from(searchCache.keys()),
  };
}
