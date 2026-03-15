/**
 * PREP Super Agent ReasoningBank
 *
 * Self-learning capability that stores and retrieves successful reasoning patterns.
 * Based on claude-flow's ReasoningBank concept for improved response quality over time.
 *
 * Features:
 * - Stores successful reasoning chains with confidence scores
 * - Retrieves similar patterns for new queries
 * - Learns from user feedback (implicit and explicit)
 * - Provides proactive insights based on historical patterns
 */

import { createServerClient } from './supabase';
import { generateEmbedding } from './openai';

// ============================================
// Types
// ============================================

export interface ReasoningStep {
  action: string;
  thought: string;
  result: unknown;
  confidence: number;
}

export interface ReasoningChain {
  id: string;
  query: string;
  queryEmbedding?: number[];
  steps: ReasoningStep[];
  outcome: 'success' | 'partial' | 'failure';
  userFeedback?: {
    rating: number; // 1-5
    comment?: string;
  };
  toolsUsed: string[];
  totalConfidence: number;
  responseTime: number;
  createdAt: number;
}

export interface SimilarPattern {
  chain: ReasoningChain;
  similarity: number;
}

export interface ProactiveInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'warning';
  title: string;
  description: string;
  confidence: number;
  relatedPatterns: string[];
  createdAt: number;
  expiresAt?: number;
}

// ============================================
// ReasoningBank Implementation
// ============================================

export class ReasoningBank {
  private supabase;
  private chainCache: Map<string, ReasoningChain> = new Map();
  private insightsCache: ProactiveInsight[] = [];

  constructor() {
    this.supabase = createServerClient();
  }

  /**
   * Store a new reasoning chain
   */
  async storeChain(chain: Omit<ReasoningChain, 'id' | 'createdAt' | 'queryEmbedding'>): Promise<string> {
    const id = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Generate embedding for the query
    let queryEmbedding: number[] | undefined;
    try {
      queryEmbedding = await generateEmbedding(chain.query);
    } catch (error) {
      console.error('Failed to generate query embedding:', error);
    }

    const fullChain: ReasoningChain = {
      ...chain,
      id,
      queryEmbedding,
      createdAt: Date.now(),
    };

    this.chainCache.set(id, fullChain);

    // Persist to database
    try {
      await this.supabase.from('reasoning_chains').insert({
        id: fullChain.id,
        query: fullChain.query,
        query_embedding: queryEmbedding,
        steps: fullChain.steps,
        outcome: fullChain.outcome,
        user_feedback: fullChain.userFeedback,
        tools_used: fullChain.toolsUsed,
        total_confidence: fullChain.totalConfidence,
        response_time: fullChain.responseTime,
        created_at: new Date(fullChain.createdAt).toISOString(),
      });
    } catch (error) {
      console.error('Failed to persist reasoning chain:', error);
    }

    // Check for new insights based on this chain
    this.analyzeForInsights(fullChain).catch(console.error);

    return id;
  }

  /**
   * Find similar reasoning patterns for a new query
   */
  async findSimilarPatterns(query: string, limit = 5): Promise<SimilarPattern[]> {
    try {
      const queryEmbedding = await generateEmbedding(query);

      const { data, error } = await this.supabase.rpc('match_reasoning_chains', {
        query_embedding: queryEmbedding,
        match_count: limit,
        match_threshold: 0.7,
      });

      if (error) {
        console.error('Failed to find similar patterns:', error);
        return [];
      }

      return (data || []).map((row: {
        id: string;
        query: string;
        steps: ReasoningStep[];
        outcome: string;
        user_feedback: { rating: number; comment?: string } | null;
        tools_used: string[];
        total_confidence: number;
        response_time: number;
        created_at: string;
        similarity: number;
      }) => ({
        chain: {
          id: row.id,
          query: row.query,
          steps: row.steps,
          outcome: row.outcome as 'success' | 'partial' | 'failure',
          userFeedback: row.user_feedback || undefined,
          toolsUsed: row.tools_used,
          totalConfidence: row.total_confidence,
          responseTime: row.response_time,
          createdAt: new Date(row.created_at).getTime(),
        },
        similarity: row.similarity,
      }));
    } catch (error) {
      console.error('Failed to find similar patterns:', error);
      return [];
    }
  }

  /**
   * Record user feedback for a reasoning chain
   */
  async recordFeedback(chainId: string, rating: number, comment?: string): Promise<void> {
    const feedback = { rating, comment };

    // Update cache
    const cached = this.chainCache.get(chainId);
    if (cached) {
      cached.userFeedback = feedback;
      this.chainCache.set(chainId, cached);
    }

    // Update database
    try {
      await this.supabase
        .from('reasoning_chains')
        .update({ user_feedback: feedback })
        .eq('id', chainId);
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  }

  /**
   * Get proactive insights based on reasoning history
   */
  async getProactiveInsights(): Promise<ProactiveInsight[]> {
    // Return cached insights if recent
    const now = Date.now();
    const validInsights = this.insightsCache.filter(
      (i) => !i.expiresAt || i.expiresAt > now
    );

    if (validInsights.length >= 3) {
      return validInsights;
    }

    // Generate new insights from database
    try {
      const { data } = await this.supabase
        .from('proactive_insights')
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('confidence', { ascending: false })
        .limit(10);

      if (data) {
        this.insightsCache = data.map((row: {
          id: string;
          type: string;
          title: string;
          description: string;
          confidence: number;
          related_patterns: string[];
          created_at: string;
          expires_at: string | null;
        }) => ({
          id: row.id,
          type: row.type as ProactiveInsight['type'],
          title: row.title,
          description: row.description,
          confidence: row.confidence,
          relatedPatterns: row.related_patterns,
          createdAt: new Date(row.created_at).getTime(),
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch proactive insights:', error);
    }

    return this.insightsCache;
  }

  /**
   * Get reasoning suggestions for a query
   */
  async getSuggestions(query: string): Promise<{
    suggestedTools: string[];
    confidence: number;
    similarSuccessful: number;
  }> {
    const patterns = await this.findSimilarPatterns(query, 10);

    if (patterns.length === 0) {
      return {
        suggestedTools: [],
        confidence: 0,
        similarSuccessful: 0,
      };
    }

    // Count successful patterns
    const successful = patterns.filter((p) => p.chain.outcome === 'success');
    const successRate = successful.length / patterns.length;

    // Aggregate tools from successful patterns
    const toolCounts = new Map<string, number>();
    for (const pattern of successful) {
      for (const tool of pattern.chain.toolsUsed) {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      }
    }

    // Sort by frequency
    const suggestedTools = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tool]) => tool);

    return {
      suggestedTools,
      confidence: successRate * (patterns[0]?.similarity || 0),
      similarSuccessful: successful.length,
    };
  }

  /**
   * Analyze a chain for potential insights
   */
  private async analyzeForInsights(chain: ReasoningChain): Promise<void> {
    // Check for anomalies (very fast or slow responses)
    const avgResponseTime = 2000; // Baseline 2 seconds
    if (chain.responseTime > avgResponseTime * 3) {
      await this.createInsight({
        type: 'anomaly',
        title: 'Slow response detected',
        description: `Query "${chain.query.slice(0, 50)}..." took ${Math.round(chain.responseTime / 1000)}s`,
        confidence: 0.8,
        relatedPatterns: [chain.id],
      });
    }

    // Check for tool usage patterns
    if (chain.toolsUsed.length > 3 && chain.outcome === 'success') {
      await this.createInsight({
        type: 'recommendation',
        title: 'Complex query handled successfully',
        description: `Used ${chain.toolsUsed.length} tools: ${chain.toolsUsed.join(', ')}`,
        confidence: chain.totalConfidence,
        relatedPatterns: [chain.id],
      });
    }
  }

  /**
   * Create a new proactive insight
   */
  private async createInsight(
    insight: Omit<ProactiveInsight, 'id' | 'createdAt'>
  ): Promise<void> {
    const fullInsight: ProactiveInsight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      expiresAt: insight.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days default
    };

    this.insightsCache.push(fullInsight);

    try {
      await this.supabase.from('proactive_insights').insert({
        id: fullInsight.id,
        type: fullInsight.type,
        title: fullInsight.title,
        description: fullInsight.description,
        confidence: fullInsight.confidence,
        related_patterns: fullInsight.relatedPatterns,
        created_at: new Date(fullInsight.createdAt).toISOString(),
        expires_at: fullInsight.expiresAt
          ? new Date(fullInsight.expiresAt).toISOString()
          : null,
      });
    } catch (error) {
      console.error('Failed to create insight:', error);
    }
  }

  /**
   * Get learning statistics
   */
  async getStats(): Promise<{
    totalChains: number;
    successRate: number;
    avgConfidence: number;
    topTools: Array<{ tool: string; count: number }>;
    recentInsights: number;
  }> {
    try {
      const { data: stats } = await this.supabase.rpc('get_reasoning_stats');

      if (stats) {
        return stats;
      }
    } catch (error) {
      console.error('Failed to get reasoning stats:', error);
    }

    // Return defaults
    return {
      totalChains: 0,
      successRate: 0,
      avgConfidence: 0,
      topTools: [],
      recentInsights: 0,
    };
  }
}

// Export singleton instance
export const reasoningBank = new ReasoningBank();
