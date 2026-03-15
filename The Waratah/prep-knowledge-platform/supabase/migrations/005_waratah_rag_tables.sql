-- Waratah RAG Tables (separate namespace from Sakura)
-- Migration: 005_waratah_rag_tables.sql
-- Created: 2026-02-12

-- Documents metadata table
CREATE TABLE IF NOT EXISTS waratah_rag_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT,
    total_chunks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chunks with embeddings (1536 dimensions for OpenAI ada-002)
CREATE TABLE IF NOT EXISTS waratah_rag_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES waratah_rag_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IVFFlat index for vector search (300 lists for ~90K chunks expected)
CREATE INDEX IF NOT EXISTS waratah_rag_chunks_embedding_idx
ON waratah_rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 300);

-- Standard indexes for queries
CREATE INDEX IF NOT EXISTS waratah_rag_chunks_document_id_idx ON waratah_rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS waratah_rag_chunks_chunk_index_idx ON waratah_rag_chunks(chunk_index);

-- Full-text search index for hybrid search
CREATE INDEX IF NOT EXISTS waratah_rag_chunks_content_fts_idx
ON waratah_rag_chunks
USING gin(to_tsvector('english', content));

-- Categories taxonomy table
CREATE TABLE IF NOT EXISTS waratah_rag_categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    document_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search Analytics for performance monitoring
CREATE TABLE IF NOT EXISTS waratah_search_analytics (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    strategy TEXT NOT NULL,
    latency_ms INTEGER,
    results_count INTEGER,
    top_similarity FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grants (service_role for server-side operations)
GRANT ALL ON waratah_rag_documents TO postgres, service_role;
GRANT ALL ON waratah_rag_chunks TO postgres, service_role;
GRANT ALL ON waratah_rag_categories TO postgres, service_role;
GRANT ALL ON waratah_search_analytics TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- Comments for documentation
COMMENT ON TABLE waratah_rag_documents IS 'Waratah venue RAG document metadata';
COMMENT ON TABLE waratah_rag_chunks IS 'Waratah venue RAG text chunks with embeddings';
COMMENT ON TABLE waratah_rag_categories IS 'Waratah venue content categories';
COMMENT ON TABLE waratah_search_analytics IS 'Waratah venue search performance tracking';

-- Vector search function for Waratah
CREATE OR REPLACE FUNCTION waratah_match_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id text,
    document_id text,
    content text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        waratah_rag_chunks.id,
        waratah_rag_chunks.document_id,
        waratah_rag_chunks.content,
        1 - (waratah_rag_chunks.embedding <=> query_embedding) AS similarity
    FROM waratah_rag_chunks
    WHERE 1 - (waratah_rag_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY waratah_rag_chunks.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Hybrid search function (vector + full-text) for Waratah
CREATE OR REPLACE FUNCTION waratah_hybrid_search(
    query_embedding vector(1536),
    query_text text,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    vector_weight float DEFAULT 0.7,
    text_weight float DEFAULT 0.3
)
RETURNS TABLE (
    id text,
    document_id text,
    content text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    WITH vector_search AS (
        SELECT
            waratah_rag_chunks.id,
            waratah_rag_chunks.document_id,
            waratah_rag_chunks.content,
            (1 - (waratah_rag_chunks.embedding <=> query_embedding)) AS vector_similarity
        FROM waratah_rag_chunks
        WHERE 1 - (waratah_rag_chunks.embedding <=> query_embedding) > match_threshold
    ),
    text_search AS (
        SELECT
            waratah_rag_chunks.id,
            ts_rank(to_tsvector('english', waratah_rag_chunks.content), plainto_tsquery('english', query_text)) AS text_rank
        FROM waratah_rag_chunks
        WHERE to_tsvector('english', waratah_rag_chunks.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        vector_search.id,
        vector_search.document_id,
        vector_search.content,
        (vector_search.vector_similarity * vector_weight + COALESCE(text_search.text_rank, 0) * text_weight) AS similarity
    FROM vector_search
    LEFT JOIN text_search ON vector_search.id = text_search.id
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

COMMENT ON FUNCTION waratah_match_chunks IS 'Vector similarity search for Waratah knowledge base';
COMMENT ON FUNCTION waratah_hybrid_search IS 'Hybrid vector + full-text search for Waratah knowledge base';
