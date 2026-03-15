-- ============================================================================
-- PREP SYSTEM RAG - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    folder_path VARCHAR(255),
    priority INTEGER DEFAULT 1,
    parent_id INTEGER REFERENCES rag_categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert KnowledgeBase categories
INSERT INTO rag_categories (code, name, description, folder_path, priority) VALUES
('KB-01', 'House Recipes', 'Proprietary recipes, batches, ingredients, fermentation, R&D', '01-House-Recipes', 1),
('KB-02', 'Bar Standards', 'Cocktail specs, menus, brand standards, spirits', '02-Bar-Standards', 1),
('KB-03', 'SOPs', 'Standard Operating Procedures', '03-SOPs', 2),
('KB-04', 'Training', 'Staff training, manuals, spirits training, testing', '04-Training-Materials', 3),
('KB-05', 'Supplier Specs', 'Equipment manuals, supplier documentation', '05-Supplier-Specs', 4),
('KB-06', 'Scientific', 'Distillation, fermentation, food science theory', '06-Scientific-Reference', 2)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),
    title VARCHAR(500),
    description TEXT,
    category_id INTEGER REFERENCES rag_categories(id),
    source VARCHAR(50) DEFAULT 'knowledgebase',
    status VARCHAR(20) DEFAULT 'pending',
    chunk_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    processing_error TEXT,
    storage_path VARCHAR(500),
    storage_bucket VARCHAR(100) DEFAULT 'documents',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    UNIQUE(file_path, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON rag_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON rag_documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON rag_documents(file_type);

-- ============================================================================
-- 3. CHUNKS TABLE (with embeddings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES rag_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    start_char INTEGER,
    end_char INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON rag_chunks USING gin(metadata);

-- ============================================================================
-- 4. SEARCH HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    query_embedding vector(1536),
    results_count INTEGER,
    top_document_ids UUID[],
    top_scores FLOAT[],
    user_id UUID,
    session_id VARCHAR(100),
    category_filter INTEGER[],
    search_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_created ON rag_search_history(created_at DESC);

-- ============================================================================
-- 5. INGESTION JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_log JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. SEMANTIC SEARCH FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    category_ids INT[] DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    file_name VARCHAR,
    category_name VARCHAR,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        d.file_name,
        cat.name AS category_name,
        c.metadata
    FROM rag_chunks c
    JOIN rag_documents d ON c.document_id = d.id
    LEFT JOIN rag_categories cat ON d.category_id = cat.id
    WHERE
        d.status = 'completed'
        AND (category_ids IS NULL OR d.category_id = ANY(category_ids))
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- 7. CONTEXT RETRIEVAL FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_chunk_context(
    target_chunk_id UUID,
    context_before INT DEFAULT 1,
    context_after INT DEFAULT 1
)
RETURNS TABLE (
    chunk_id UUID,
    content TEXT,
    chunk_index INTEGER,
    is_target BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    doc_id UUID;
    target_index INTEGER;
BEGIN
    SELECT document_id, rag_chunks.chunk_index INTO doc_id, target_index
    FROM rag_chunks WHERE id = target_chunk_id;

    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.chunk_index,
        (c.id = target_chunk_id) AS is_target
    FROM rag_chunks c
    WHERE c.document_id = doc_id
      AND c.chunk_index BETWEEN (target_index - context_before) AND (target_index + context_after)
    ORDER BY c.chunk_index;
END;
$$;

-- ============================================================================
-- 8. AUTO-UPDATE TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON rag_documents;
CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS categories_updated_at ON rag_categories;
CREATE TRIGGER categories_updated_at
    BEFORE UPDATE ON rag_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 9. STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW rag_category_stats AS
SELECT
    c.id,
    c.code,
    c.name,
    COUNT(d.id) AS document_count,
    SUM(d.chunk_count) AS total_chunks,
    SUM(d.total_tokens) AS total_tokens,
    SUM(d.file_size_bytes) AS total_size_bytes,
    COUNT(CASE WHEN d.status = 'completed' THEN 1 END) AS completed_count,
    COUNT(CASE WHEN d.status = 'failed' THEN 1 END) AS failed_count
FROM rag_categories c
LEFT JOIN rag_documents d ON c.id = d.category_id
GROUP BY c.id, c.code, c.name;

-- ============================================================================
-- DONE! Verify with:
-- SELECT * FROM rag_categories;
-- ============================================================================
