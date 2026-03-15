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
