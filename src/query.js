// query.js — Interfaz de búsqueda
// Equivale a queryMemories() del artículo, pero el coseno lo hace PostgreSQL

import { embedOne } from "./embeddings.js";
import { classifyMemory } from "./classify.js";
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
 * Si auto_classify=true, llama a OpenAI para sugerir tipo, criticidad y tags.
 */
export async function saveMemory(options) {
  const content = options.content.trim();
  const id = `manual_${Date.now()}_${randomUUID().slice(0, 8)}`;

  // Auto-clasificación opcional
  let memoryType = options.memoryType || "memory";
  let criticality = options.criticality || "normal";
  let tags = options.tags || [];
  let classificationSource = "manual";
  let classificationConfidence = null;

  if (options.autoClassify) {
    const classification = await classifyMemory(content);
    if (classification) {
      // Solo sobrescribir campos no provistos explícitamente por el usuario
      if (!options.memoryType) memoryType = classification.memory_type;
      if (!options.criticality) criticality = classification.criticality;
      if (!options.tags || options.tags.length === 0) tags = classification.tags;
      classificationSource = "auto";
      classificationConfidence = classification.confidence;
    }
  }

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
    memoryType,
    status: options.status || "active",
    criticality,
    tags,
    lastVerifiedAt: options.lastVerifiedAt || null,
    createdAt: new Date().toISOString(),
    metadata: {
      source: "mcp",
      created_by_agent: true,
      author: options.author || null,
      classification_source: classificationSource,
      ...(classificationConfidence !== null ? { classification_confidence: classificationConfidence } : {}),
    },
    chunkIndex: 0,
    tokenCount: estimateTokens(content),
    embedding,
  });

  return { id, content, memory_type: memoryType, criticality, tags, classification_source: classificationSource };
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

// ─── reflect_memories ─────────────────────────────────────────────────────────

const REFLECT_MODEL = "gpt-4o-mini";

const REFLECT_SYSTEM = `You are a technical memory analyst for a software development knowledge base.
Given a set of technical memories from a project, analyze them and respond with a JSON object (no markdown, no extra text) with:
- summary: string — brief description of the overall knowledge state
- findings: array of objects with:
    - type: "contradiction" | "consolidation" | "outdated" | "redundant"
    - description: string explaining the finding
    - memory_ids: array of affected memory IDs (use the id field)
    - suggested_action: string — what to do (deprecate, consolidate, verify, etc.)
- suggested_new_memories: array of objects with:
    - content: string
    - memory_type: string
    - criticality: string
    - tags: array of strings
    reason why this new memory would be valuable
- suggested_deprecations: array of memory IDs that should be deprecated

Rules:
- Be conservative: only flag clear contradictions, not subtle differences
- Do not suggest deprecating memories without strong reason
- Focus on technical accuracy and usefulness for AI coding agents
- Keep suggested_new_memories concise and actionable
- Respond with valid JSON only`;

/**
 * Analiza memorias existentes para detectar contradicciones, redundancias
 * y oportunidades de consolidación. Usa OpenAI para el análisis.
 *
 * @param {Object} options
 * @param {string} [options.project]
 * @param {string} [options.organization]
 * @param {string} [options.repo_name]
 * @param {string} [options.focus] — tema de análisis (e.g. "security", "architecture")
 * @param {number} [options.limit] — máximo de memorias a analizar (default 30)
 * @returns {Promise<Object>}
 */
export async function reflectMemories(options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const limit = Math.min(options.limit || 30, 60);

  // Recuperar memorias activas del scope solicitado
  const rows = await getRecent({
    limit,
    organization: options.organization || null,
    project: options.project || null,
    repoName: options.repo_name || null,
    memoryType: options.memory_type || null,
    status: "active",
  });

  if (rows.length === 0) {
    return {
      summary: "No se encontraron memorias activas para el scope solicitado.",
      findings: [],
      suggested_new_memories: [],
      suggested_deprecations: [],
      analyzed_count: 0,
    };
  }

  // Construir contexto compacto para el modelo
  const memoriesText = rows
    .map((m) => {
      const meta = [m.memory_type, m.criticality, m.repo_name, m.project].filter(Boolean).join(" / ");
      return `ID: ${m.id}\nType: ${meta}\nContent: ${m.content.slice(0, 400)}`;
    })
    .join("\n\n---\n\n");

  const userMessage = [
    options.focus ? `Focus: ${options.focus}` : null,
    options.repo_name ? `Repository: ${options.repo_name}` : null,
    options.project ? `Project: ${options.project}` : null,
    `\nMemories to analyze (${rows.length}):\n\n${memoriesText}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: REFLECT_MODEL,
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        { role: "system", content: REFLECT_SYSTEM },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI reflect error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("OpenAI devolvió respuesta vacía");

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`No se pudo parsear la respuesta de OpenAI: ${raw.slice(0, 200)}`);
  }

  return {
    analyzed_count: rows.length,
    scope: {
      organization: options.organization || null,
      project: options.project || null,
      repo_name: options.repo_name || null,
      focus: options.focus || null,
    },
    summary: result.summary ?? "",
    findings: Array.isArray(result.findings) ? result.findings : [],
    suggested_new_memories: Array.isArray(result.suggested_new_memories) ? result.suggested_new_memories : [],
    suggested_deprecations: Array.isArray(result.suggested_deprecations) ? result.suggested_deprecations : [],
  };
}
