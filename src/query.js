// query.js — Interfaz de búsqueda
// Equivale a queryMemories() del artículo, pero el coseno lo hace PostgreSQL

import { embedOne } from "./embeddings.js";
import { randomUUID } from "crypto";
import {
  queryByEmbedding,
  getRecent,
  insertMemory,
  deprecateMemoryById,
  updateMemoryById,
  getMemoriesByIds,
  getTimeline,
} from "./db.js";
import { estimateTokens } from "./chunker.js";

/**
 * Busca memorias por similitud semántica.
 *
 * En el artículo original:
 *   1. Carga TODOS los BLOBs de SQLite
 *   2. Reconstruye Float32Array para cada fila
 *   3. Calcula coseno en un loop JS
 *   4. Ordena y devuelve top N
 *   → Con 7.000 chunks: ~15ms
 *
 * En nuestra versión PostgreSQL:
 *   1. Genera embedding de la query con OpenAI
 *   2. PostgreSQL usa el índice HNSW para encontrar los vecinos más cercanos
 *   3. Devuelve top N con score de similitud
 *   → Sin importar cuántos chunks: <5ms (HNSW es sublineal)
 */
export async function searchMemories(queryText, options = {}) {
  const limit = options.limit || 5;
  const types = options.types || null;

  // Embeber la query
  const queryEmbedding = await embedOne(queryText);

  // Buscar en PostgreSQL (coseno nativo con operador <=>)
  const rows = await queryByEmbedding(queryEmbedding, {
    ...options,
    limit,
    types,
    queryText,
  });

  return rows.map((row) => ({
    id: row.id,
    public_id: row.public_id,
    content: row.content,
    source_type: row.source_type,
    source_path: row.source_path,
    session_key: row.session_key,
    organization: row.organization,
    project: row.project,
    repo_name: row.repo_name,
    memory_type: row.memory_type,
    status: row.status,
    criticality: row.criticality,
    tags: row.tags,
    last_verified_at: row.last_verified_at,
    created_at: row.created_at,
    score: row.hybrid_score == null ? null : parseFloat(parseFloat(row.hybrid_score).toFixed(4)),
    vector_score: row.similarity == null ? null : parseFloat(parseFloat(row.similarity).toFixed(4)),
    text_rank: row.text_rank == null ? null : parseFloat(parseFloat(row.text_rank).toFixed(4)),
    status_score: row.status_score == null ? null : parseFloat(parseFloat(row.status_score).toFixed(4)),
    criticality_score: row.criticality_score == null ? null : parseFloat(parseFloat(row.criticality_score).toFixed(4)),
    verification_score: row.verification_score == null ? null : parseFloat(parseFloat(row.verification_score).toFixed(4)),
    metadata: row.metadata,
  }));
}

/**
 * Obtiene memorias recientes (sin búsqueda semántica)
 */
export async function recentMemories(options = {}) {
  const rows = await getRecent(options);

  return rows.map((row) => ({
    id: row.id,
    public_id: row.public_id,
    content: row.content,
    source_type: row.source_type,
    source_path: row.source_path,
    session_key: row.session_key,
    organization: row.organization,
    project: row.project,
    repo_name: row.repo_name,
    memory_type: row.memory_type,
    status: row.status,
    criticality: row.criticality,
    tags: row.tags,
    last_verified_at: row.last_verified_at,
    created_at: row.created_at,
    metadata: row.metadata,
  }));
}

/**
 * Guarda una memoria manual con embedding para uso desde MCP.
 */
export async function saveMemory(options) {
  const content = options.content.trim();
  const id = `manual_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const embedding = await embedOne(content);

  await insertMemory({
    id,
    content,
    sourceType: "memory",
    sourcePath: options.sourcePath || "mcp://save_memory",
    sessionKey: null,
    organization: options.organization || null,
    project: options.project || null,
    repoName: options.repoName || null,
    memoryType: options.memoryType || "memory",
    status: options.status || "active",
    criticality: options.criticality || "normal",
    tags: options.tags || [],
    lastVerifiedAt: options.lastVerifiedAt || null,
    createdAt: new Date().toISOString(),
    metadata: {
      source: "mcp",
      created_by_agent: true,
      author: options.author || null,
    },
    chunkIndex: 0,
    tokenCount: estimateTokens(content),
    embedding,
  });

  return { id, content };
}

export async function deprecateMemory(id, options = {}) {
  return deprecateMemoryById(id, options);
}

export async function updateMemory(id, options = {}) {
  const updates = {
    sourcePath: options.sourcePath,
    organization: options.organization,
    project: options.project,
    repoName: options.repoName,
    memoryType: options.memoryType,
    status: options.status,
    criticality: options.criticality,
    tags: options.tags,
    lastVerifiedAt: options.lastVerifiedAt,
    metadata: {
      updated: {
        at: new Date().toISOString(),
        author: options.author || null,
        reason: options.reason || null,
      },
    },
  };

  if (options.content) {
    const content = options.content.trim();
    updates.content = content;
    updates.embedding = await embedOne(content);
    updates.tokenCount = estimateTokens(content);
  }

  return updateMemoryById(id, updates);
}

/**
 * Guarda el resumen de una sesión o una observación de tool-use como memoria.
 * Usado por los event endpoints del HTTP server y la herramienta MCP save_session_summary.
 */
export async function saveSessionSummary(options) {
  const content = options.content.trim();
  const id = `session_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const embedding = await embedOne(content);

  await insertMemory({
    id,
    content,
    sourceType: "session",
    sourcePath: options.sourcePath || `session://${options.sessionKey || "unknown"}`,
    sessionKey: options.sessionKey || null,
    organization: options.organization || null,
    project: options.project || null,
    repoName: options.repoName || null,
    memoryType: options.memoryType || "session_summary",
    status: "active",
    criticality: options.criticality || "normal",
    tags: options.tags || [],
    lastVerifiedAt: null,
    createdAt: new Date().toISOString(),
    metadata: {
      source: options.source || "event",
      created_by_agent: true,
      author: options.author || null,
    },
    chunkIndex: 0,
    tokenCount: estimateTokens(content),
    embedding,
  });

  return { id, content };
}
export async function verifyMemory(id, options = {}) {
  const verifiedAt = new Date().toISOString();
  return updateMemoryById(id, {
    lastVerifiedAt: verifiedAt,
    metadata: {
      verified: {
        at: verifiedAt,
        author: options.author || null,
        note: options.note || null,
      },
    },
  });
}

// ─── get_memories por IDs ─────────────────────────────────────────────────────

/**
 * Devuelve memorias completas por lista de IDs o public_ids.
 */
export async function getMemories(ids) {
  const rows = await getMemoriesByIds(ids);
  return rows.map((row) => ({
    id: row.id,
    public_id: row.public_id,
    content: row.content,
    source_type: row.source_type,
    source_path: row.source_path,
    session_key: row.session_key,
    organization: row.organization,
    project: row.project,
    repo_name: row.repo_name,
    memory_type: row.memory_type,
    status: row.status,
    criticality: row.criticality,
    tags: row.tags,
    last_verified_at: row.last_verified_at,
    created_at: row.created_at,
    metadata: row.metadata,
  }));
}

// ─── search_memories_compact ──────────────────────────────────────────────────

/**
 * Búsqueda semántica con salida reducida para minimizar uso de context window.
 * Devuelve: id, public_id, score, snippet (150 chars), source_type, memory_type,
 *           project, repo_name, criticality, created_at
 */
export async function searchMemoriesCompact(queryText, options = {}) {
  const full = await searchMemories(queryText, options);
  return full.map((r) => ({
    id: r.id,
    public_id: r.public_id,
    score: r.score,
    snippet: r.content.slice(0, 150).replace(/\s+/g, " "),
    source_type: r.source_type,
    memory_type: r.memory_type,
    project: r.project,
    repo_name: r.repo_name,
    criticality: r.criticality,
    created_at: r.created_at,
  }));
}

// ─── memory_timeline ─────────────────────────────────────────────────────────

/**
 * Memorias agrupadas por fecha en orden cronológico inverso.
 */
export async function memoryTimeline(options = {}) {
  const groups = await getTimeline(options);
  return groups.map(({ date, memories }) => ({
    date,
    count: memories.length,
    memories: memories.map((row) => ({
      id: row.id,
      public_id: row.public_id,
      snippet: row.content.slice(0, 200).replace(/\s+/g, " "),
      source_type: row.source_type,
      memory_type: row.memory_type,
      project: row.project,
      repo_name: row.repo_name,
      status: row.status,
      criticality: row.criticality,
      tags: row.tags,
      created_at: row.created_at,
    })),
  }));
}
