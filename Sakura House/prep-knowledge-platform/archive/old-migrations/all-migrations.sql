-- Match documents function for RAG retrieval
-- Uses the rag_chunks table created by rag_ingest.py

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    jsonb_build_object(
      'filename', d.file_name,
      'title', d.title,
      'category', cat.name,
      'chunk_index', c.chunk_index,
      'document_id', d.id::text
    ) AS metadata
  FROM rag_chunks c
  JOIN rag_documents d ON c.document_id = d.id
  LEFT JOIN rag_categories cat ON d.category_id = cat.id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for faster similarity search (if not already exists)
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Chat history tables
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  sources jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for message retrieval
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id);
-- Phase 7: Search Optimization Migration
-- Run via Supabase SQL Editor

-- ============================================
-- 1. Optimize IVFFlat Index for ~90K chunks
-- ============================================
-- Recommended lists = sqrt(n) ≈ 300 for 90K rows

-- Drop existing index (if exists)
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Create optimized index
-- Note: This may take a few minutes on 90K rows
CREATE INDEX idx_chunks_embedding ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 300);

-- ============================================
-- 2. Add Full-Text Search Column
-- ============================================

-- Add tsvector column for hybrid search
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON rag_chunks USING gin(fts);

-- ============================================
-- 3. Search Analytics Table
-- ============================================

CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  result_count INT DEFAULT 0,
  top_similarity FLOAT,
  avg_similarity FLOAT,
  search_type TEXT DEFAULT 'vector',  -- 'vector', 'hybrid', 'text'
  category_filter TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_hash ON search_analytics(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at DESC);

-- ============================================
-- 4. Search Feedback Table
-- ============================================

CREATE TABLE IF NOT EXISTS search_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_analytics(id),
  chunk_id UUID REFERENCES rag_chunks(id),
  feedback_type TEXT NOT NULL,  -- 'helpful', 'not_helpful', 'clicked'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_feedback_search ON search_feedback(search_id);

-- ============================================
-- 5. Hybrid Search Function
-- ============================================

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.5,
  vector_weight FLOAT DEFAULT 0.7,
  text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT,
  text_rank FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      c.id,
      c.content,
      1 - (c.embedding <=> query_embedding) as vector_sim,
      c.metadata
    FROM rag_chunks c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  text_results AS (
    SELECT
      c.id,
      ts_rank(c.fts, plainto_tsquery('english', query_text)) as text_rank
    FROM rag_chunks c
    WHERE c.fts @@ plainto_tsquery('english', query_text)
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, t.id) as id,
      v.content,
      v.vector_sim,
      COALESCE(t.text_rank, 0) as text_rank,
      v.metadata,
      COALESCE(v.vector_sim, 0) * vector_weight +
      COALESCE(t.text_rank, 0) * text_weight as score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
    WHERE v.id IS NOT NULL  -- Require vector match
  )
  SELECT
    combined.id,
    combined.content,
    combined.vector_sim as similarity,
    combined.text_rank,
    combined.score as combined_score,
    combined.metadata
  FROM combined
  ORDER BY combined.score DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- 6. Search with Analytics Logging
-- ============================================

CREATE OR REPLACE FUNCTION search_with_analytics(
  p_query_text TEXT,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 10,
  p_match_threshold FLOAT DEFAULT 0.5,
  p_search_type TEXT DEFAULT 'vector',
  p_category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB,
  search_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_search_id UUID;
  v_start_time TIMESTAMPTZ;
  v_result_count INT;
  v_top_sim FLOAT;
  v_avg_sim FLOAT;
BEGIN
  v_start_time := clock_timestamp();

  -- Perform the search
  IF p_search_type = 'hybrid' THEN
    CREATE TEMP TABLE temp_results ON COMMIT DROP AS
    SELECT h.id, h.content, h.similarity, h.metadata
    FROM hybrid_search(p_query_text, p_query_embedding, p_match_count, p_match_threshold) h;
  ELSE
    CREATE TEMP TABLE temp_results ON COMMIT DROP AS
    SELECT c.id, c.content, 1 - (c.embedding <=> p_query_embedding) as similarity, c.metadata
    FROM rag_chunks c
    WHERE 1 - (c.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_match_count;
  END IF;

  -- Calculate stats
  SELECT COUNT(*), MAX(similarity), AVG(similarity)
  INTO v_result_count, v_top_sim, v_avg_sim
  FROM temp_results;

  -- Log analytics
  INSERT INTO search_analytics (
    query_text, query_hash, result_count,
    top_similarity, avg_similarity, search_type,
    category_filter, latency_ms
  ) VALUES (
    p_query_text,
    md5(p_query_text),
    v_result_count,
    v_top_sim,
    v_avg_sim,
    p_search_type,
    p_category_filter,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INT
  ) RETURNING id INTO v_search_id;

  -- Return results with search_id
  RETURN QUERY
  SELECT t.id, t.content, t.similarity, t.metadata, v_search_id
  FROM temp_results t;
END;
$$;

-- ============================================
-- 7. Popular Queries View
-- ============================================

CREATE OR REPLACE VIEW popular_queries AS
SELECT
  query_hash,
  query_text,
  COUNT(*) as search_count,
  AVG(top_similarity) as avg_top_similarity,
  AVG(latency_ms) as avg_latency_ms,
  MAX(created_at) as last_searched
FROM search_analytics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY query_hash, query_text
ORDER BY search_count DESC
LIMIT 50;

-- ============================================
-- 8. Grant Permissions
-- ============================================

GRANT SELECT ON popular_queries TO authenticated;
GRANT SELECT, INSERT ON search_analytics TO authenticated;
GRANT SELECT, INSERT ON search_feedback TO authenticated;

COMMENT ON TABLE search_analytics IS 'Phase 7: Search query logging for optimization';
COMMENT ON TABLE search_feedback IS 'Phase 7: User feedback on search results';
COMMENT ON FUNCTION hybrid_search IS 'Phase 7: Combined vector + full-text search';
-- PREP Super Agent Memory Tables
-- Provides persistent conversation memory and self-learning capabilities
-- Based on ElizaOS four-tier memory model

-- ============================================
-- Conversation Sessions (Episodic Memory)
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON conversation_sessions(updated_at);

-- ============================================
-- Learned Patterns (Semantic Memory)
-- ============================================

CREATE TABLE IF NOT EXISTS learned_patterns (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('intent', 'entity', 'workflow', 'preference')),
  occurrences INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  examples JSONB DEFAULT '[]'::jsonb
);

-- Index for pattern lookups
CREATE INDEX IF NOT EXISTS idx_patterns_pattern ON learned_patterns(pattern);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON learned_patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_occurrences ON learned_patterns(occurrences DESC);

-- Unique constraint on pattern text
CREATE UNIQUE INDEX IF NOT EXISTS idx_patterns_unique ON learned_patterns(pattern);

-- ============================================
-- User Preferences (Semantic Memory)
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT DEFAULT 'inferred' CHECK (source IN ('explicit', 'inferred')),
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prefs_user_id ON user_preferences(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prefs_user_key ON user_preferences(user_id, key);

-- ============================================
-- Interaction Analytics
-- ============================================

CREATE TABLE IF NOT EXISTS interaction_analytics (
  id SERIAL PRIMARY KEY,
  session_id TEXT REFERENCES conversation_sessions(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  tool_used TEXT,
  response_time_ms INTEGER,
  was_helpful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_session ON interaction_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON interaction_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON interaction_analytics(created_at);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get recent patterns for a category
CREATE OR REPLACE FUNCTION get_recent_patterns(
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  pattern TEXT,
  category TEXT,
  occurrences INTEGER,
  confidence REAL,
  examples JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lp.pattern,
    lp.category,
    lp.occurrences,
    lp.confidence,
    lp.examples
  FROM learned_patterns lp
  WHERE (p_category IS NULL OR lp.category = p_category)
  ORDER BY lp.occurrences DESC, lp.last_seen DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get user context
CREATE OR REPLACE FUNCTION get_user_context(p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_object_agg(key, value)
  INTO result
  FROM user_preferences
  WHERE user_id = p_user_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for service role (full access)
CREATE POLICY "Service role full access to sessions" ON conversation_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to patterns" ON learned_patterns
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to preferences" ON user_preferences
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to analytics" ON interaction_analytics
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE conversation_sessions IS 'Episodic memory - stores conversation histories and session context';
COMMENT ON TABLE learned_patterns IS 'Semantic memory - stores learned patterns from interactions';
COMMENT ON TABLE user_preferences IS 'User-specific preferences and settings';
COMMENT ON TABLE interaction_analytics IS 'Analytics data for improving agent responses';
-- PREP Super Agent ReasoningBank Tables
-- Self-learning capability that stores and retrieves successful reasoning patterns

-- ============================================
-- Reasoning Chains (Learning from Experience)
-- ============================================

CREATE TABLE IF NOT EXISTS reasoning_chains (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  query_embedding vector(1536),  -- OpenAI embedding dimension
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'partial', 'failure')),
  user_feedback JSONB,  -- { rating: 1-5, comment?: string }
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  total_confidence REAL DEFAULT 0.5,
  response_time INTEGER,  -- milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_chains_embedding ON reasoning_chains
  USING ivfflat (query_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for outcome filtering
CREATE INDEX IF NOT EXISTS idx_chains_outcome ON reasoning_chains(outcome);
CREATE INDEX IF NOT EXISTS idx_chains_created_at ON reasoning_chains(created_at DESC);

-- ============================================
-- Proactive Insights
-- ============================================

CREATE TABLE IF NOT EXISTS proactive_insights (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('trend', 'anomaly', 'recommendation', 'warning')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  related_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index for active insights
CREATE INDEX IF NOT EXISTS idx_insights_expires ON proactive_insights(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insights_type ON proactive_insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_confidence ON proactive_insights(confidence DESC);

-- ============================================
-- Functions
-- ============================================

-- Function to match reasoning chains by vector similarity
CREATE OR REPLACE FUNCTION match_reasoning_chains(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id TEXT,
  query TEXT,
  steps JSONB,
  outcome TEXT,
  user_feedback JSONB,
  tools_used TEXT[],
  total_confidence REAL,
  response_time INTEGER,
  created_at TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.query,
    rc.steps,
    rc.outcome,
    rc.user_feedback,
    rc.tools_used,
    rc.total_confidence,
    rc.response_time,
    rc.created_at,
    1 - (rc.query_embedding <=> query_embedding) AS similarity
  FROM reasoning_chains rc
  WHERE rc.query_embedding IS NOT NULL
    AND 1 - (rc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY rc.query_embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get reasoning statistics
CREATE OR REPLACE FUNCTION get_reasoning_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_count INTEGER;
  success_count INTEGER;
  avg_conf REAL;
  top_tools JSONB;
  insight_count INTEGER;
BEGIN
  -- Get total chains
  SELECT COUNT(*) INTO total_count FROM reasoning_chains;

  -- Get success count
  SELECT COUNT(*) INTO success_count FROM reasoning_chains WHERE outcome = 'success';

  -- Get average confidence
  SELECT AVG(total_confidence) INTO avg_conf FROM reasoning_chains;

  -- Get top tools
  SELECT jsonb_agg(tool_stats) INTO top_tools FROM (
    SELECT jsonb_build_object('tool', tool, 'count', count) AS tool_stats
    FROM (
      SELECT unnest(tools_used) AS tool, COUNT(*) AS count
      FROM reasoning_chains
      GROUP BY tool
      ORDER BY count DESC
      LIMIT 5
    ) t
  ) t2;

  -- Get recent insights count
  SELECT COUNT(*) INTO insight_count
  FROM proactive_insights
  WHERE created_at > NOW() - INTERVAL '7 days';

  result := jsonb_build_object(
    'totalChains', total_count,
    'successRate', CASE WHEN total_count > 0 THEN success_count::REAL / total_count ELSE 0 END,
    'avgConfidence', COALESCE(avg_conf, 0),
    'topTools', COALESCE(top_tools, '[]'::jsonb),
    'recentInsights', insight_count
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE reasoning_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to chains" ON reasoning_chains
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to insights" ON proactive_insights
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE reasoning_chains IS 'Stores successful reasoning patterns for self-learning';
COMMENT ON TABLE proactive_insights IS 'AI-generated insights from pattern analysis';
COMMENT ON FUNCTION match_reasoning_chains IS 'Find similar reasoning patterns using vector similarity';
COMMENT ON FUNCTION get_reasoning_stats IS 'Get aggregate statistics about reasoning performance';
