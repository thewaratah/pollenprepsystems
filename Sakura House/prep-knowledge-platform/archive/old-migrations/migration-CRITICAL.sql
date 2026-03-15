-- CRITICAL: Search function only (run this first)

-- Add Full-Text Search Column
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON rag_chunks USING gin(fts);

-- Hybrid Search Function
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
    WHERE v.id IS NOT NULL
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

-- Search Analytics Table
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  result_count INT DEFAULT 0,
  top_similarity FLOAT,
  avg_similarity FLOAT,
  search_type TEXT DEFAULT 'vector',
  category_filter TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_hash ON search_analytics(query_hash);

-- Main Search Function with Analytics
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
