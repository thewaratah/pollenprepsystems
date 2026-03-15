# Supabase RAG Setup Guide - PREP SYSTEM

Complete guide for setting up a Retrieval-Augmented Generation (RAG) system using Supabase with pgvector for the PREP SYSTEM KnowledgeBase.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Supabase Project Setup](#supabase-project-setup)
4. [Database Schema](#database-schema)
5. [pgvector Configuration](#pgvector-configuration)
6. [Storage Buckets](#storage-buckets)
7. [Document Ingestion Pipeline](#document-ingestion-pipeline)
8. [Edge Functions](#edge-functions)
9. [Query Interface](#query-interface)
10. [Security & RLS Policies](#security--rls-policies)
11. [PREP AGENT Integration](#prep-agent-integration)
12. [Monitoring & Maintenance](#monitoring--maintenance)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PREP SYSTEM RAG                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ KnowledgeBase│    │   RAGFiles   │    │   Airtable   │                  │
│  │  (328 files) │    │  (Reference) │    │   (Live DB)  │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                          │
│         └───────────────────┼───────────────────┘                          │
│                             ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INGESTION PIPELINE                                 │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │  │
│  │  │ Extract │→ │  Parse  │→ │  Chunk  │→ │ Embed   │→ │  Store  │     │  │
│  │  │  Text   │  │ Content │  │  Text   │  │ (OpenAI)│  │(Supabase│     │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                             │                                              │
│                             ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         SUPABASE                                      │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │   PostgreSQL    │  │    pgvector     │  │    Storage      │       │  │
│  │  │   (Metadata)    │  │  (Embeddings)   │  │  (Raw Files)    │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                            │  │
│  │  │ Edge Functions  │  │   Auth / RLS    │                            │  │
│  │  │ (Search API)    │  │  (Security)     │                            │  │
│  │  └─────────────────┘  └─────────────────┘                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                             │                                              │
│                             ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        PREP AGENT                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │Query Handler│  │  Workflow   │  │  Decision   │                   │  │
│  │  │             │  │ Orchestrator│  │   Engine    │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Accounts & Tools

| Service | Purpose | Cost |
|---------|---------|------|
| [Supabase](https://supabase.com) | Database, Storage, Edge Functions | Free tier available |
| [OpenAI API](https://platform.openai.com) | Embeddings (`text-embedding-3-small`) | ~$0.02 per 1M tokens |
| Python 3.10+ | Ingestion pipeline | Free |
| Node.js 18+ | Edge Functions (optional) | Free |

### Install Dependencies

```bash
# Python dependencies
pip install supabase openai python-dotenv tiktoken \
    pypdf python-docx pandas openpyxl unstructured

# Node.js (for Edge Functions)
npm install @supabase/supabase-js openai
```

### Environment Variables

Create `.env` in your project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-...

# PREP SYSTEM
KNOWLEDGEBASE_PATH=/Users/evanstroevee/Desktop/PREP SYSTEM/KnowledgeBase
AIRTABLE_PAT=pat...
AIRTABLE_BASE_ID=appNsFRhuU47e9qlR
```

---

## Supabase Project Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Configure:
   - **Name:** `prep-system-rag`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to Sydney (e.g., `ap-southeast-2`)
4. Click **Create new project** (wait 2-3 minutes)

### Step 2: Get API Keys

From Project Settings → API:

| Key | Location | Use |
|-----|----------|-----|
| `Project URL` | API Settings | `SUPABASE_URL` |
| `anon public` | API Settings | `SUPABASE_ANON_KEY` (client-side) |
| `service_role` | API Settings | `SUPABASE_SERVICE_ROLE_KEY` (server-side only!) |

### Step 3: Enable pgvector Extension

In SQL Editor, run:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## Database Schema

### Complete Schema Setup

Run this SQL in the Supabase SQL Editor:

```sql
-- ============================================================================
-- PREP SYSTEM RAG - Complete Database Schema
-- Version: 1.0
-- Last Updated: 2026-02-01
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For text search

-- ============================================================================
-- 1. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,      -- e.g., 'KB-01', 'KB-02'
    name VARCHAR(100) NOT NULL,             -- e.g., 'House Recipes'
    description TEXT,
    folder_path VARCHAR(255),               -- e.g., '01-House-Recipes'
    priority INTEGER DEFAULT 1,             -- Query priority (1 = highest)
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

    -- File metadata
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_type VARCHAR(20) NOT NULL,          -- pdf, csv, docx, xlsx, json
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),                   -- SHA-256 for deduplication

    -- Content metadata
    title VARCHAR(500),
    description TEXT,
    category_id INTEGER REFERENCES rag_categories(id),
    source VARCHAR(50) DEFAULT 'knowledgebase',  -- knowledgebase, airtable, manual

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending',    -- pending, processing, completed, failed
    chunk_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    processing_error TEXT,

    -- Storage
    storage_path VARCHAR(500),               -- Supabase Storage path
    storage_bucket VARCHAR(100) DEFAULT 'documents',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(file_path, file_hash)
);

-- Indexes for documents
CREATE INDEX idx_documents_category ON rag_documents(category_id);
CREATE INDEX idx_documents_status ON rag_documents(status);
CREATE INDEX idx_documents_file_type ON rag_documents(file_type);
CREATE INDEX idx_documents_file_name ON rag_documents USING gin(file_name gin_trgm_ops);

-- ============================================================================
-- 3. DOCUMENT CHUNKS TABLE (with embeddings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES rag_documents(id) ON DELETE CASCADE,

    -- Chunk content
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,            -- Position in document
    token_count INTEGER,

    -- Metadata extracted from content
    metadata JSONB DEFAULT '{}',             -- Flexible metadata storage

    -- Vector embedding (1536 dimensions for text-embedding-3-small)
    embedding vector(1536),

    -- Chunk boundaries
    start_char INTEGER,
    end_char INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(document_id, chunk_index)
);

-- CRITICAL: Create HNSW index for fast similarity search
-- m = 16, ef_construction = 64 are good defaults
CREATE INDEX idx_chunks_embedding ON rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Additional indexes
CREATE INDEX idx_chunks_document ON rag_chunks(document_id);
CREATE INDEX idx_chunks_metadata ON rag_chunks USING gin(metadata);

-- ============================================================================
-- 4. SEARCH HISTORY TABLE (for analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    query_embedding vector(1536),

    -- Results
    results_count INTEGER,
    top_document_ids UUID[],
    top_scores FLOAT[],

    -- Context
    user_id UUID,                            -- If using Supabase Auth
    session_id VARCHAR(100),
    category_filter INTEGER[],

    -- Performance
    search_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_history_created ON rag_search_history(created_at DESC);

-- ============================================================================
-- 5. INGESTION JOBS TABLE (for tracking pipeline runs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job info
    job_type VARCHAR(50) NOT NULL,           -- full_sync, incremental, single_file
    status VARCHAR(20) DEFAULT 'pending',    -- pending, running, completed, failed

    -- Progress
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Errors
    error_log JSONB DEFAULT '[]',

    -- Metadata
    config JSONB DEFAULT '{}',               -- Chunk size, overlap, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function: Semantic search with filters
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

-- Function: Hybrid search (semantic + keyword)
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10,
    semantic_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    combined_score FLOAT,
    semantic_score FLOAT,
    keyword_score FLOAT,
    file_name VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_results AS (
        SELECT
            c.id,
            c.document_id,
            c.content,
            1 - (c.embedding <=> query_embedding) AS score
        FROM rag_chunks c
        JOIN rag_documents d ON c.document_id = d.id
        WHERE d.status = 'completed'
    ),
    keyword_results AS (
        SELECT
            c.id,
            ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) AS score
        FROM rag_chunks c
        JOIN rag_documents d ON c.document_id = d.id
        WHERE d.status = 'completed'
          AND to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        s.id AS chunk_id,
        s.document_id,
        s.content,
        (semantic_weight * s.score + (1 - semantic_weight) * COALESCE(k.score, 0)) AS combined_score,
        s.score AS semantic_score,
        COALESCE(k.score, 0) AS keyword_score,
        d.file_name
    FROM semantic_results s
    LEFT JOIN keyword_results k ON s.id = k.id
    JOIN rag_documents d ON s.document_id = d.id
    WHERE s.score > match_threshold
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- Function: Get document context (surrounding chunks)
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
    -- Get document and index of target chunk
    SELECT document_id, chunk_index INTO doc_id, target_index
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
-- 7. TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER categories_updated_at
    BEFORE UPDATE ON rag_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. VIEWS
-- ============================================================================

-- View: Document statistics by category
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

-- View: Recent search queries
CREATE OR REPLACE VIEW rag_recent_searches AS
SELECT
    query,
    results_count,
    search_time_ms,
    created_at
FROM rag_search_history
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
```

---

## pgvector Configuration

### Understanding Vector Dimensions

| Model | Dimensions | Cost | Quality |
|-------|------------|------|---------|
| `text-embedding-3-small` | 1536 | $0.02/1M tokens | Good |
| `text-embedding-3-large` | 3072 | $0.13/1M tokens | Better |
| `text-embedding-ada-002` | 1536 | $0.10/1M tokens | Legacy |

**Recommendation:** Use `text-embedding-3-small` for cost-effectiveness.

### Index Types

```sql
-- HNSW (Hierarchical Navigable Small World) - RECOMMENDED
-- Faster queries, more memory, good for production
CREATE INDEX idx_chunks_embedding_hnsw ON rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- IVFFlat - Alternative for very large datasets
-- Slower queries, less memory
CREATE INDEX idx_chunks_embedding_ivfflat ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Distance Functions

| Function | Use Case | SQL Operator |
|----------|----------|--------------|
| Cosine | Text similarity | `<=>` |
| L2 (Euclidean) | Spatial data | `<->` |
| Inner Product | Normalized vectors | `<#>` |

---

## Storage Buckets

### Create Storage Buckets

In Supabase Dashboard → Storage:

1. **Create `documents` bucket:**
   - Name: `documents`
   - Public: No
   - File size limit: 50MB
   - Allowed MIME types: `application/pdf,text/csv,application/vnd.openxmlformats-officedocument.*,application/json`

2. **Create `processed` bucket:**
   - Name: `processed`
   - Public: No
   - For storing extracted text/metadata

### Storage Policies

```sql
-- Allow authenticated users to read documents
CREATE POLICY "Users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow service role to upload
CREATE POLICY "Service can upload documents"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'documents');
```

---

## Document Ingestion Pipeline

### Python Ingestion Script

Create `scripts/rag_ingest.py`:

```python
#!/usr/bin/env python3
"""
PREP SYSTEM RAG Ingestion Pipeline
Processes KnowledgeBase documents and stores embeddings in Supabase.
"""

import os
import hashlib
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

import tiktoken
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# Document parsers
import pypdf
from docx import Document as DocxDocument
import pandas as pd

load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

@dataclass
class Config:
    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    # OpenAI
    openai_api_key: str = os.getenv("OPENAI_API_KEY")
    embedding_model: str = "text-embedding-3-small"

    # Chunking
    chunk_size: int = 1000  # tokens
    chunk_overlap: int = 200  # tokens

    # Paths
    knowledgebase_path: str = os.getenv("KNOWLEDGEBASE_PATH",
        "/Users/evanstroevee/Desktop/PREP SYSTEM/KnowledgeBase")

    # Processing
    batch_size: int = 100  # Embeddings per API call

    # Category mapping
    category_mapping: Dict[str, str] = None

    def __post_init__(self):
        self.category_mapping = {
            "01-House-Recipes": "KB-01",
            "02-Bar-Standards": "KB-02",
            "03-SOPs": "KB-03",
            "04-Training-Materials": "KB-04",
            "05-Supplier-Specs": "KB-05",
            "06-Scientific-Reference": "KB-06",
        }

config = Config()

# ============================================================================
# Clients
# ============================================================================

supabase: Client = create_client(config.supabase_url, config.supabase_key)
openai_client = OpenAI(api_key=config.openai_api_key)
tokenizer = tiktoken.encoding_for_model("gpt-4")

# ============================================================================
# Document Parsers
# ============================================================================

def extract_text_pdf(file_path: Path) -> str:
    """Extract text from PDF file."""
    text = []
    with open(file_path, 'rb') as f:
        reader = pypdf.PdfReader(f)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
    return "\n\n".join(text)

def extract_text_docx(file_path: Path) -> str:
    """Extract text from DOCX file."""
    doc = DocxDocument(file_path)
    return "\n\n".join([para.text for para in doc.paragraphs if para.text.strip()])

def extract_text_csv(file_path: Path) -> str:
    """Convert CSV to readable text format."""
    df = pd.read_csv(file_path)

    # Convert to markdown-like format
    lines = []
    for _, row in df.iterrows():
        row_text = " | ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
        lines.append(row_text)

    return "\n".join(lines)

def extract_text_xlsx(file_path: Path) -> str:
    """Convert Excel to readable text format."""
    df = pd.read_excel(file_path)

    lines = []
    for _, row in df.iterrows():
        row_text = " | ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
        lines.append(row_text)

    return "\n".join(lines)

def extract_text_json(file_path: Path) -> str:
    """Convert JSON to readable text format."""
    with open(file_path, 'r') as f:
        data = json.load(f)

    def flatten_json(obj, prefix=""):
        lines = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                new_prefix = f"{prefix}.{k}" if prefix else k
                lines.extend(flatten_json(v, new_prefix))
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                lines.extend(flatten_json(item, f"{prefix}[{i}]"))
        else:
            lines.append(f"{prefix}: {obj}")
        return lines

    return "\n".join(flatten_json(data))

def extract_text(file_path: Path) -> Optional[str]:
    """Extract text from file based on extension."""
    extractors = {
        '.pdf': extract_text_pdf,
        '.docx': extract_text_docx,
        '.csv': extract_text_csv,
        '.xlsx': extract_text_xlsx,
        '.json': extract_text_json,
        '.txt': lambda p: p.read_text(),
        '.md': lambda p: p.read_text(),
    }

    ext = file_path.suffix.lower()
    if ext in extractors:
        try:
            return extractors[ext](file_path)
        except Exception as e:
            print(f"Error extracting {file_path}: {e}")
            return None
    return None

# ============================================================================
# Chunking
# ============================================================================

def count_tokens(text: str) -> int:
    """Count tokens in text."""
    return len(tokenizer.encode(text))

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[Dict]:
    """Split text into overlapping chunks by token count."""
    tokens = tokenizer.encode(text)
    chunks = []

    start = 0
    chunk_index = 0

    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = tokenizer.decode(chunk_tokens)

        chunks.append({
            "content": chunk_text,
            "chunk_index": chunk_index,
            "token_count": len(chunk_tokens),
            "start_token": start,
            "end_token": end,
        })

        chunk_index += 1
        start = end - overlap if end < len(tokens) else len(tokens)

    return chunks

# ============================================================================
# Embeddings
# ============================================================================

def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings for a batch of texts."""
    response = openai_client.embeddings.create(
        model=config.embedding_model,
        input=texts
    )
    return [item.embedding for item in response.data]

# ============================================================================
# Database Operations
# ============================================================================

def get_category_id(folder_name: str) -> Optional[int]:
    """Get category ID from folder name."""
    code = config.category_mapping.get(folder_name)
    if not code:
        return None

    result = supabase.table("rag_categories").select("id").eq("code", code).execute()
    if result.data:
        return result.data[0]["id"]
    return None

def file_exists(file_hash: str) -> bool:
    """Check if file already processed."""
    result = supabase.table("rag_documents").select("id").eq("file_hash", file_hash).execute()
    return len(result.data) > 0

def insert_document(doc_data: Dict) -> str:
    """Insert document and return ID."""
    result = supabase.table("rag_documents").insert(doc_data).execute()
    return result.data[0]["id"]

def insert_chunks(chunks: List[Dict]) -> None:
    """Insert chunks with embeddings."""
    supabase.table("rag_chunks").insert(chunks).execute()

def update_document_status(doc_id: str, status: str, chunk_count: int = 0, total_tokens: int = 0, error: str = None):
    """Update document processing status."""
    update_data = {
        "status": status,
        "chunk_count": chunk_count,
        "total_tokens": total_tokens,
        "processed_at": datetime.utcnow().isoformat(),
    }
    if error:
        update_data["processing_error"] = error

    supabase.table("rag_documents").update(update_data).eq("id", doc_id).execute()

# ============================================================================
# Main Ingestion
# ============================================================================

def get_file_hash(file_path: Path) -> str:
    """Calculate SHA-256 hash of file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            sha256.update(chunk)
    return sha256.hexdigest()

def process_file(file_path: Path, category_id: Optional[int] = None) -> bool:
    """Process a single file: extract, chunk, embed, store."""
    print(f"Processing: {file_path.name}")

    # Calculate hash for deduplication
    file_hash = get_file_hash(file_path)

    # Skip if already processed
    if file_exists(file_hash):
        print(f"  Skipping (already processed): {file_path.name}")
        return True

    # Extract text
    text = extract_text(file_path)
    if not text:
        print(f"  Failed to extract text: {file_path.name}")
        return False

    # Create document record
    doc_data = {
        "file_name": file_path.name,
        "file_path": str(file_path),
        "file_type": file_path.suffix.lower().lstrip('.'),
        "file_size_bytes": file_path.stat().st_size,
        "file_hash": file_hash,
        "title": file_path.stem,
        "category_id": category_id,
        "status": "processing",
    }

    doc_id = insert_document(doc_data)

    try:
        # Chunk text
        chunks = chunk_text(text, config.chunk_size, config.chunk_overlap)
        print(f"  Created {len(chunks)} chunks")

        # Get embeddings in batches
        all_chunk_data = []
        total_tokens = 0

        for i in range(0, len(chunks), config.batch_size):
            batch = chunks[i:i + config.batch_size]
            texts = [c["content"] for c in batch]
            embeddings = get_embeddings(texts)

            for chunk, embedding in zip(batch, embeddings):
                all_chunk_data.append({
                    "document_id": doc_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "token_count": chunk["token_count"],
                    "embedding": embedding,
                    "metadata": {
                        "start_token": chunk["start_token"],
                        "end_token": chunk["end_token"],
                    }
                })
                total_tokens += chunk["token_count"]

        # Insert chunks
        insert_chunks(all_chunk_data)

        # Update document status
        update_document_status(doc_id, "completed", len(chunks), total_tokens)
        print(f"  Completed: {len(chunks)} chunks, {total_tokens} tokens")
        return True

    except Exception as e:
        update_document_status(doc_id, "failed", error=str(e))
        print(f"  Failed: {e}")
        return False

def ingest_directory(directory: Path, category_id: Optional[int] = None) -> Dict[str, int]:
    """Ingest all files in a directory."""
    stats = {"processed": 0, "skipped": 0, "failed": 0}

    supported_extensions = {'.pdf', '.docx', '.csv', '.xlsx', '.json', '.txt', '.md'}

    for file_path in directory.rglob('*'):
        if file_path.is_file() and file_path.suffix.lower() in supported_extensions:
            # Skip archive folder
            if '_archive' in str(file_path):
                continue

            # Determine category from path
            rel_path = file_path.relative_to(Path(config.knowledgebase_path))
            folder_name = rel_path.parts[0] if len(rel_path.parts) > 1 else None
            cat_id = get_category_id(folder_name) if folder_name else category_id

            if process_file(file_path, cat_id):
                stats["processed"] += 1
            else:
                stats["failed"] += 1

    return stats

def main():
    """Main ingestion entry point."""
    print("=" * 60)
    print("PREP SYSTEM RAG Ingestion Pipeline")
    print("=" * 60)

    kb_path = Path(config.knowledgebase_path)
    if not kb_path.exists():
        print(f"Error: KnowledgeBase path not found: {kb_path}")
        return

    print(f"\nSource: {kb_path}")
    print(f"Chunk size: {config.chunk_size} tokens")
    print(f"Chunk overlap: {config.chunk_overlap} tokens")
    print(f"Embedding model: {config.embedding_model}")
    print()

    stats = ingest_directory(kb_path)

    print("\n" + "=" * 60)
    print("Ingestion Complete")
    print("=" * 60)
    print(f"Processed: {stats['processed']}")
    print(f"Failed: {stats['failed']}")

if __name__ == "__main__":
    main()
```

### Run Ingestion

```bash
# Full ingestion
python scripts/rag_ingest.py

# Single file (modify script or use CLI args)
python scripts/rag_ingest.py --file "path/to/file.pdf"
```

---

## Edge Functions

### Search API Edge Function

Create `supabase/functions/search/index.ts`:

```typescript
// supabase/functions/search/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query: string;
  match_threshold?: number;
  match_count?: number;
  category_ids?: number[];
  include_context?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    const body: SearchRequest = await req.json();
    const {
      query,
      match_threshold = 0.7,
      match_count = 10,
      category_ids = null,
      include_context = false,
    } = body;

    // Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search using database function
    const { data: results, error } = await supabase.rpc("search_documents", {
      query_embedding: queryEmbedding,
      match_threshold,
      match_count,
      category_ids,
    });

    if (error) throw error;

    // Optionally get context for each result
    let enrichedResults = results;
    if (include_context && results.length > 0) {
      enrichedResults = await Promise.all(
        results.map(async (result: any) => {
          const { data: context } = await supabase.rpc("get_chunk_context", {
            target_chunk_id: result.chunk_id,
            context_before: 1,
            context_after: 1,
          });
          return { ...result, context };
        })
      );
    }

    return new Response(
      JSON.stringify({
        query,
        results: enrichedResults,
        count: results.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

### Deploy Edge Function

```bash
# Login to Supabase CLI
supabase login

# Link to project
supabase link --project-ref your-project-ref

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...

# Deploy function
supabase functions deploy search
```

---

## Query Interface

### Python Query Client

Create `scripts/rag_query.py`:

```python
#!/usr/bin/env python3
"""
PREP SYSTEM RAG Query Client
Query the KnowledgeBase using semantic search.
"""

import os
from typing import List, Optional
from dataclasses import dataclass

from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

@dataclass
class SearchResult:
    content: str
    similarity: float
    file_name: str
    category: str
    metadata: dict

class RAGClient:
    def __init__(self):
        self.supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_ANON_KEY")
        )
        self.openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def search(
        self,
        query: str,
        match_count: int = 5,
        match_threshold: float = 0.7,
        category_ids: Optional[List[int]] = None
    ) -> List[SearchResult]:
        """Semantic search across KnowledgeBase."""

        # Get query embedding
        response = self.openai.embeddings.create(
            model="text-embedding-3-small",
            input=query
        )
        query_embedding = response.data[0].embedding

        # Search via RPC
        result = self.supabase.rpc(
            "search_documents",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
                "category_ids": category_ids
            }
        ).execute()

        return [
            SearchResult(
                content=r["content"],
                similarity=r["similarity"],
                file_name=r["file_name"],
                category=r["category_name"],
                metadata=r["metadata"]
            )
            for r in result.data
        ]

    def ask(self, question: str, match_count: int = 5) -> str:
        """Ask a question and get an answer using RAG."""

        # Search for relevant context
        results = self.search(question, match_count=match_count)

        if not results:
            return "I couldn't find relevant information in the KnowledgeBase."

        # Build context
        context = "\n\n---\n\n".join([
            f"Source: {r.file_name} ({r.category})\n{r.content}"
            for r in results
        ])

        # Generate answer
        response = self.openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are a helpful assistant for the PREP SYSTEM,
                    a food preparation management system for a bar/restaurant.
                    Answer questions based on the provided context from the KnowledgeBase.
                    If the context doesn't contain the answer, say so."""
                },
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {question}"
                }
            ]
        )

        return response.choices[0].message.content

# CLI Usage
if __name__ == "__main__":
    import sys

    client = RAGClient()

    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        print(f"\nQuery: {query}\n")
        print("=" * 60)

        answer = client.ask(query)
        print(answer)
    else:
        print("Usage: python rag_query.py <your question>")
        print("Example: python rag_query.py How do I make Wasabi Mayo?")
```

### Usage Examples

```bash
# Simple search
python scripts/rag_query.py "What's the recipe for wasabi mayo?"

# From Python
from scripts.rag_query import RAGClient

client = RAGClient()
results = client.search("cocktail garnish standards", match_count=5)
answer = client.ask("What are the fermentation procedures?")
```

---

## Security & RLS Policies

### Row Level Security Setup

```sql
-- Enable RLS on all tables
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_search_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: Service Role (full access for ingestion)
-- ============================================================================

CREATE POLICY "Service role full access to documents"
ON rag_documents FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access to chunks"
ON rag_chunks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- POLICIES: Authenticated Users (read-only search)
-- ============================================================================

CREATE POLICY "Authenticated users can read documents"
ON rag_documents FOR SELECT
TO authenticated
USING (status = 'completed');

CREATE POLICY "Authenticated users can read chunks"
ON rag_chunks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM rag_documents d
        WHERE d.id = rag_chunks.document_id
        AND d.status = 'completed'
    )
);

CREATE POLICY "Authenticated users can read categories"
ON rag_categories FOR SELECT
TO authenticated
USING (is_active = true);

-- ============================================================================
-- POLICIES: Anonymous Users (public search if needed)
-- ============================================================================

-- Uncomment if you want public access:
-- CREATE POLICY "Anyone can search completed documents"
-- ON rag_documents FOR SELECT
-- TO anon
-- USING (status = 'completed');

-- ============================================================================
-- POLICIES: Search History (user-specific)
-- ============================================================================

CREATE POLICY "Users can insert their own search history"
ON rag_search_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read their own search history"
ON rag_search_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);
```

### API Key Security

```bash
# NEVER expose service_role key to client
# Use anon key for client-side queries

# For server-side ingestion, use environment variables
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# For edge functions, set as secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

---

## PREP AGENT Integration

### Query Handler Agent Integration

Update `.claude/agents/prep-system/query-handler.md` to use RAG:

```markdown
## RAG Integration

When processing queries, the Query Handler should:

1. **Classify Query Type:**
   - Operational (Airtable MCP) → Direct database query
   - Knowledge (RAG) → Supabase vector search

2. **RAG Query Flow:**
   ```
   User Query → Classify → Generate Embedding → Search → Format Response
   ```

3. **Category Routing:**
   | Query Pattern | Category Filter |
   |---------------|-----------------|
   | "recipe for..." | KB-01 (House Recipes) |
   | "cocktail spec..." | KB-02 (Bar Standards) |
   | "how to..." | KB-03 (SOPs), KB-04 (Training) |
   | "equipment manual..." | KB-05 (Supplier Specs) |
   | "why does..." | KB-06 (Scientific) |
```

### MCP Server for RAG (Optional)

Create an MCP server for RAG queries:

```python
# mcp_servers/rag_server.py
from mcp.server import Server
from mcp.types import Tool
from scripts.rag_query import RAGClient

server = Server("prep-rag")
client = RAGClient()

@server.tool()
async def search_knowledgebase(query: str, category: str = None, limit: int = 5):
    """Search the PREP SYSTEM KnowledgeBase for relevant information."""
    category_map = {
        "recipes": [1],
        "cocktails": [2],
        "sops": [3],
        "training": [4],
        "equipment": [5],
        "science": [6],
    }
    category_ids = category_map.get(category)
    results = client.search(query, match_count=limit, category_ids=category_ids)
    return [{"content": r.content, "source": r.file_name, "score": r.similarity} for r in results]

@server.tool()
async def ask_knowledgebase(question: str):
    """Ask a question and get an answer from the KnowledgeBase."""
    return client.ask(question)
```

---

## Monitoring & Maintenance

### Statistics Queries

```sql
-- Document stats by category
SELECT * FROM rag_category_stats;

-- Processing status summary
SELECT
    status,
    COUNT(*) as count,
    SUM(chunk_count) as total_chunks
FROM rag_documents
GROUP BY status;

-- Recent ingestion jobs
SELECT
    job_type,
    status,
    processed_files,
    failed_files,
    completed_at - started_at as duration
FROM rag_ingestion_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Search performance
SELECT
    DATE(created_at) as date,
    COUNT(*) as searches,
    AVG(search_time_ms) as avg_time_ms,
    AVG(results_count) as avg_results
FROM rag_search_history
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Maintenance Tasks

```sql
-- Reprocess failed documents
UPDATE rag_documents
SET status = 'pending', processing_error = NULL
WHERE status = 'failed';

-- Clean up orphaned chunks
DELETE FROM rag_chunks
WHERE document_id NOT IN (SELECT id FROM rag_documents);

-- Vacuum analyze for performance
VACUUM ANALYZE rag_chunks;

-- Rebuild HNSW index (if needed after bulk insert)
REINDEX INDEX idx_chunks_embedding;
```

### Scheduled Jobs (Supabase pg_cron)

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily vacuum at 3 AM
SELECT cron.schedule(
    'vacuum-rag-tables',
    '0 3 * * *',
    $$VACUUM ANALYZE rag_chunks; VACUUM ANALYZE rag_documents;$$
);

-- Weekly stats cleanup (keep 30 days)
SELECT cron.schedule(
    'cleanup-search-history',
    '0 4 * * 0',
    $$DELETE FROM rag_search_history WHERE created_at < NOW() - INTERVAL '30 days';$$
);
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "vector extension not found" | pgvector not enabled | Run `CREATE EXTENSION vector;` |
| Slow searches | Missing HNSW index | Create index on embedding column |
| "dimension mismatch" | Wrong embedding size | Ensure 1536 dimensions for text-embedding-3-small |
| Rate limit errors | Too many OpenAI calls | Implement batching and backoff |
| Large file failures | Memory limits | Increase chunk size or process in streams |

### Debug Queries

```sql
-- Check embedding dimensions
SELECT
    id,
    array_length(embedding, 1) as dimensions
FROM rag_chunks
LIMIT 5;

-- Find documents without chunks
SELECT d.id, d.file_name, d.status
FROM rag_documents d
LEFT JOIN rag_chunks c ON d.id = c.document_id
WHERE c.id IS NULL AND d.status = 'completed';

-- Test similarity search manually
SELECT
    c.content,
    1 - (c.embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM rag_chunks c
ORDER BY c.embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Performance Tuning

```sql
-- Increase work_mem for large queries
SET work_mem = '256MB';

-- Tune HNSW search
SET hnsw.ef_search = 100;  -- Default is 40, higher = more accurate but slower

-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM search_documents(
    '[0.1, 0.2, ...]'::vector,
    0.7,
    10,
    NULL
);
```

---

## Quick Start Checklist

- [ ] Create Supabase project
- [ ] Enable pgvector extension
- [ ] Run complete schema SQL
- [ ] Create storage buckets
- [ ] Set up environment variables
- [ ] Install Python dependencies
- [ ] Run ingestion pipeline
- [ ] Deploy search Edge Function
- [ ] Test queries
- [ ] Set up RLS policies
- [ ] Configure monitoring

---

## Cost Estimation

| Component | Usage | Monthly Cost |
|-----------|-------|--------------|
| Supabase (Free) | 500MB database, 1GB storage | $0 |
| Supabase (Pro) | 8GB database, 100GB storage | $25 |
| OpenAI Embeddings | 328 files × ~5K tokens avg | ~$0.03 |
| OpenAI Embeddings | 1000 queries/month | ~$0.02 |
| **Total (Free tier)** | | **~$0.05/month** |
| **Total (Pro tier)** | | **~$25.05/month** |

---

*Last Updated: 2026-02-01*
*PREP SYSTEM RAG Documentation v1.0*
