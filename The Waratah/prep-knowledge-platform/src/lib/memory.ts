/**
 * PREP Super Agent Memory Service
 *
 * Provides conversation persistence and self-learning capabilities
 * using Supabase for storage and ElizaOS-inspired patterns.
 *
 * Four-Tier Memory Model:
 * 1. Vector Memory (Semantic) - RAG embeddings for knowledge retrieval
 * 2. Episodic Memory (Experience) - Conversation histories and interactions
 * 3. Semantic Memory (Facts) - Learned patterns and user preferences
 * 4. Working Memory (Active) - Current session context
 */

import { createServerClient } from './supabase';

// ============================================
// Types
// ============================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    result?: unknown;
  }>;
}

export interface ConversationSession {
  id: string;
  userId?: string;
  messages: ConversationMessage[];
  context: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface LearnedPattern {
  id: string;
  pattern: string;
  category: 'intent' | 'entity' | 'workflow' | 'preference';
  occurrences: number;
  confidence: number;
  lastSeen: number;
  examples: string[];
}

export interface UserPreference {
  id: string;
  userId: string;
  key: string;
  value: unknown;
  source: 'explicit' | 'inferred';
  confidence: number;
  updatedAt: number;
}

// ============================================
// Episodic Memory (Conversation History)
// ============================================

export class EpisodicMemory {
  private supabase;
  private sessionCache: Map<string, ConversationSession> = new Map();

  constructor() {
    this.supabase = createServerClient();
  }

  /**
   * Get or create a conversation session
   */
  async getSession(sessionId: string): Promise<ConversationSession> {
    // Check cache first
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId)!;
    }

    // Try to load from database
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      // Create new session
      const session: ConversationSession = {
        id: sessionId,
        messages: [],
        context: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessionCache.set(sessionId, session);
      return session;
    }

    const session: ConversationSession = {
      id: data.id,
      userId: data.user_id,
      messages: data.messages || [],
      context: data.context || {},
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };

    this.sessionCache.set(sessionId, session);
    return session;
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    message: Omit<ConversationMessage, 'timestamp'>
  ): Promise<void> {
    const session = await this.getSession(sessionId);

    session.messages.push({
      ...message,
      timestamp: Date.now(),
    });

    session.updatedAt = Date.now();

    // Keep only last 50 messages in memory
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }

    this.sessionCache.set(sessionId, session);

    // Persist to database (async, don't wait)
    this.persistSession(session).catch(console.error);
  }

  /**
   * Get recent conversation context
   */
  async getRecentContext(sessionId: string, limit = 10): Promise<string> {
    const session = await this.getSession(sessionId);
    const recent = session.messages.slice(-limit);

    return recent
      .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n');
  }

  /**
   * Update session context
   */
  async updateContext(sessionId: string, updates: Record<string, unknown>): Promise<void> {
    const session = await this.getSession(sessionId);
    session.context = { ...session.context, ...updates };
    session.updatedAt = Date.now();
    this.sessionCache.set(sessionId, session);
    this.persistSession(session).catch(console.error);
  }

  private async persistSession(session: ConversationSession): Promise<void> {
    try {
      await this.supabase.from('conversation_sessions').upsert({
        id: session.id,
        user_id: session.userId,
        messages: session.messages,
        context: session.context,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      });
    } catch (error) {
      console.error('Failed to persist session:', error);
    }
  }
}

// ============================================
// Semantic Memory (Learned Patterns)
// ============================================

export class SemanticMemory {
  private supabase;
  private patternCache: Map<string, LearnedPattern> = new Map();

  constructor() {
    this.supabase = createServerClient();
  }

  /**
   * Record a pattern occurrence
   */
  async recordPattern(
    pattern: string,
    category: LearnedPattern['category'],
    example: string
  ): Promise<void> {
    const existing = this.patternCache.get(pattern);

    if (existing) {
      existing.occurrences++;
      existing.lastSeen = Date.now();
      existing.confidence = Math.min(1, existing.confidence + 0.05);
      if (!existing.examples.includes(example)) {
        existing.examples = [...existing.examples.slice(-4), example];
      }
      this.patternCache.set(pattern, existing);
    } else {
      const newPattern: LearnedPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        pattern,
        category,
        occurrences: 1,
        confidence: 0.5,
        lastSeen: Date.now(),
        examples: [example],
      };
      this.patternCache.set(pattern, newPattern);
    }

    // Persist async
    this.persistPatterns().catch(console.error);
  }

  /**
   * Get top patterns for a category
   */
  async getTopPatterns(category?: LearnedPattern['category'], limit = 10): Promise<LearnedPattern[]> {
    const patterns = Array.from(this.patternCache.values());
    const filtered = category ? patterns.filter((p) => p.category === category) : patterns;
    return filtered
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  /**
   * Extract patterns from a message
   */
  extractPatterns(message: string): Array<{ pattern: string; category: LearnedPattern['category'] }> {
    const patterns: Array<{ pattern: string; category: LearnedPattern['category'] }> = [];
    const lower = message.toLowerCase();

    // Intent patterns
    const intentKeywords = {
      status: ['status', "what's", 'how is', 'check', 'progress'],
      recipe: ['recipe', 'ingredients', 'how to make', 'method'],
      order: ['order', 'ordering', 'need to buy', 'purchase'],
      prep: ['prep', 'prepare', 'batch', 'tasks'],
      stock: ['stock', 'inventory', 'count', 'stocktake'],
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        patterns.push({ pattern: `intent:${intent}`, category: 'intent' });
      }
    }

    // Entity patterns (item/recipe names mentioned)
    const entityMatches = message.match(/["']([^"']+)["']|(?:about|for|with)\s+(\w+(?:\s+\w+)?)/gi);
    if (entityMatches) {
      for (const match of entityMatches) {
        const entity = match.replace(/["']/g, '').replace(/^(about|for|with)\s+/i, '').trim();
        if (entity.length > 2 && entity.length < 50) {
          patterns.push({ pattern: `entity:${entity.toLowerCase()}`, category: 'entity' });
        }
      }
    }

    return patterns;
  }

  private async persistPatterns(): Promise<void> {
    try {
      const patterns = Array.from(this.patternCache.values());
      if (patterns.length === 0) return;

      await this.supabase.from('learned_patterns').upsert(
        patterns.map((p) => ({
          id: p.id,
          pattern: p.pattern,
          category: p.category,
          occurrences: p.occurrences,
          confidence: p.confidence,
          last_seen: new Date(p.lastSeen).toISOString(),
          examples: p.examples,
        }))
      );
    } catch (error) {
      console.error('Failed to persist patterns:', error);
    }
  }

  /**
   * Load patterns from database
   */
  async loadPatterns(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('learned_patterns')
        .select('*')
        .order('occurrences', { ascending: false })
        .limit(100);

      if (data) {
        for (const row of data) {
          this.patternCache.set(row.pattern, {
            id: row.id,
            pattern: row.pattern,
            category: row.category,
            occurrences: row.occurrences,
            confidence: row.confidence,
            lastSeen: new Date(row.last_seen).getTime(),
            examples: row.examples || [],
          });
        }
      }
    } catch (error) {
      console.error('Failed to load patterns:', error);
    }
  }
}

// ============================================
// Working Memory (Active Context)
// ============================================

export class WorkingMemory {
  private context: Map<string, unknown> = new Map();
  private expirations: Map<string, number> = new Map();

  /**
   * Set a working memory value with optional TTL
   */
  set(key: string, value: unknown, ttlMs?: number): void {
    this.context.set(key, value);
    if (ttlMs) {
      this.expirations.set(key, Date.now() + ttlMs);
    }
  }

  /**
   * Get a working memory value
   */
  get<T>(key: string): T | undefined {
    // Check expiration
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.context.delete(key);
      this.expirations.delete(key);
      return undefined;
    }
    return this.context.get(key) as T | undefined;
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.context.has(key) && (!this.expirations.has(key) || Date.now() <= this.expirations.get(key)!);
  }

  /**
   * Clear all working memory
   */
  clear(): void {
    this.context.clear();
    this.expirations.clear();
  }

  /**
   * Get all current context
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.context) {
      if (!this.expirations.has(key) || Date.now() <= this.expirations.get(key)!) {
        result[key] = value;
      }
    }
    return result;
  }
}

// ============================================
// Unified Memory Manager
// ============================================

export class PrepMemoryManager {
  public episodic: EpisodicMemory;
  public semantic: SemanticMemory;
  public working: WorkingMemory;

  private static instance: PrepMemoryManager | null = null;

  private constructor() {
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.working = new WorkingMemory();
  }

  static getInstance(): PrepMemoryManager {
    if (!PrepMemoryManager.instance) {
      PrepMemoryManager.instance = new PrepMemoryManager();
    }
    return PrepMemoryManager.instance;
  }

  /**
   * Initialize memory systems
   */
  async initialize(): Promise<void> {
    await this.semantic.loadPatterns();
  }

  /**
   * Process an incoming message
   */
  async processMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    // Add to episodic memory
    await this.episodic.addMessage(sessionId, { role, content });

    // Extract and record patterns
    if (role === 'user') {
      const patterns = this.semantic.extractPatterns(content);
      for (const { pattern, category } of patterns) {
        await this.semantic.recordPattern(pattern, category, content);
      }
    }

    // Update working memory with latest context
    this.working.set('lastMessage', { role, content, timestamp: Date.now() });
    this.working.set('sessionId', sessionId);
  }

  /**
   * Get enhanced context for response generation
   */
  async getEnhancedContext(sessionId: string, currentMessage: string): Promise<{
    conversationHistory: string;
    topPatterns: LearnedPattern[];
    workingContext: Record<string, unknown>;
  }> {
    const conversationHistory = await this.episodic.getRecentContext(sessionId);
    const topPatterns = await this.semantic.getTopPatterns(undefined, 5);
    const workingContext = this.working.getAll();

    return {
      conversationHistory,
      topPatterns,
      workingContext,
    };
  }
}

// Export singleton instance
export const memoryManager = PrepMemoryManager.getInstance();
