-- DROP with exact signature, then recreate with proper joins

DROP FUNCTION IF EXISTS search_with_analytics(text, vector, integer, double precision, text, text);

CREATE OR REPLACE FUNCTION search_with_analytics(
  p_query_text TEXT,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 10,
  p_match_threshold FLOAT DEFAULT 0.5,
  p_search_type TEXT DEFAULT 'vector',
  p_category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  result_id UUID,
  result_content TEXT,
  result_similarity FLOAT,
  result_metadata JSONB,
  result_search_id UUID
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

  -- Vector search with proper joins to get metadata
  CREATE TEMP TABLE IF NOT EXISTS temp_search_results (
    chunk_id UUID,
    chunk_content TEXT,
    chunk_similarity FLOAT,
    chunk_metadata JSONB
  ) ON COMMIT DROP;

  INSERT INTO temp_search_results
  SELECT
    c.id,
    c.content,
    (1 - (c.embedding <=> p_query_embedding)),
    jsonb_build_object(
      'filename', d.file_name,
      'title', d.title,
      'category', cat.name,
      'chunk_index', c.chunk_index,
      'document_id', d.id::text
    )
  FROM rag_chunks c
  JOIN rag_documents d ON c.document_id = d.id
  LEFT JOIN rag_categories cat ON d.category_id = cat.id
  WHERE (1 - (c.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_match_count;

  -- Calculate stats
  SELECT COUNT(*), MAX(chunk_similarity), AVG(chunk_similarity)
  INTO v_result_count, v_top_sim, v_avg_sim
  FROM temp_search_results;

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

  -- Return results with metadata
  RETURN QUERY
  SELECT
    chunk_id,
    chunk_content,
    chunk_similarity,
    chunk_metadata,
    v_search_id
  FROM temp_search_results;

END;
$$;
