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
