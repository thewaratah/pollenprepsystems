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
