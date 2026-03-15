-- MINIMAL: Just the search function (no index creation - that's already done)

-- Search Analytics Table (fast)
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

-- Simple Vector Search Function with Analytics
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

  -- Simple vector search (no hybrid for now)
  CREATE TEMP TABLE temp_results ON COMMIT DROP AS
  SELECT c.id, c.content, 1 - (c.embedding <=> p_query_embedding) as similarity, c.metadata
  FROM rag_chunks c
  WHERE 1 - (c.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_match_count;

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

  -- Return results
  RETURN QUERY
  SELECT t.id, t.content, t.similarity, t.metadata, v_search_id
  FROM temp_results t;
END;
$$;
