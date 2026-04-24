-- ============================================================
-- Memoria Vectorial para agente IA
-- Adaptado de Carlos Azaustre (SQLite) → PostgreSQL + pgvector
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla principal: equivalente a 'memories' del artículo
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  source_type   TEXT NOT NULL,       -- session, daily, memory, brain
  source_path   TEXT,
  session_key   TEXT,
  organization  TEXT,
  project       TEXT,
  repo_name     TEXT,
  memory_type   TEXT NOT NULL DEFAULT 'memory',
  status        TEXT NOT NULL DEFAULT 'active',
  criticality   TEXT NOT NULL DEFAULT 'normal',
  tags          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB,
  chunk_index   INTEGER DEFAULT 0,
  token_count   INTEGER DEFAULT 0,
  embedding     vector(1536)         -- openai text-embedding-3-small = 1536 dims
);

-- Migración idempotente para instalaciones existentes
ALTER TABLE memories ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS repo_name TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS memory_type TEXT NOT NULL DEFAULT 'memory';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS criticality TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Control de ingesta incremental (equivalente a ingest_log)
CREATE TABLE IF NOT EXISTS ingest_log (
  source_path   TEXT PRIMARY KEY,
  last_modified TEXT NOT NULL,
  last_ingested TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chunk_count   INTEGER DEFAULT 0
);

-- Índice HNSW para búsqueda por coseno nativo en PostgreSQL
-- Reemplaza la fuerza bruta en JS del artículo original
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_memories_source_type ON memories(source_type);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_session_key ON memories(session_key);
CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(organization, project, repo_name);
CREATE INDEX IF NOT EXISTS idx_memories_memory_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
CREATE INDEX IF NOT EXISTS idx_memories_criticality ON memories(criticality);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING gin(tags);
