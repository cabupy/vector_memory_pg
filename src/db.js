// db.js — PostgreSQL + pgvector
// Reemplaza: better-sqlite3 + BLOBs + coseno en JS
// Ahora: pg pool + vector(1536) + coseno nativo con operador <=>

import pg from "pg";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("[DB] Error inesperado:", err.message);
});

/**
 * Inicializa el schema (CREATE TABLE, índices, etc.)
 */
export async function initDb() {
  const schemaPath = join(__dirname, "..", "sql", "schema.sql");
  const schema = await readFile(schemaPath, "utf-8");
  await pool.query(schema);
  return pool;
}

/**
 * Inserta un chunk con su embedding en la DB
 */
export async function insertMemory(memory) {
  const embeddingStr = memory.embedding
    ? `[${memory.embedding.join(",")}]`
    : null;

  await pool.query(
    `INSERT INTO memories (
       id, content, source_type, source_path, session_key,
       organization, project, repo_name, memory_type, status, criticality, tags, last_verified_at,
       created_at, metadata, chunk_index, token_count, embedding
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::vector)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        source_type = EXCLUDED.source_type,
        source_path = EXCLUDED.source_path,
        session_key = EXCLUDED.session_key,
        organization = EXCLUDED.organization,
        project = EXCLUDED.project,
        repo_name = EXCLUDED.repo_name,
        memory_type = EXCLUDED.memory_type,
        status = EXCLUDED.status,
        criticality = EXCLUDED.criticality,
        tags = EXCLUDED.tags,
        last_verified_at = EXCLUDED.last_verified_at,
        metadata = EXCLUDED.metadata,
        chunk_index = EXCLUDED.chunk_index,
        embedding = EXCLUDED.embedding,
        token_count = EXCLUDED.token_count`,
    [
      memory.id,
      memory.content,
      memory.sourceType,
      memory.sourcePath,
      memory.sessionKey || null,
      memory.organization || null,
      memory.project || null,
      memory.repoName || null,
      memory.memoryType || memory.sourceType || "memory",
      memory.status || "active",
      memory.criticality || "normal",
      memory.tags || [],
      memory.lastVerifiedAt || null,
      memory.createdAt || new Date().toISOString(),
      memory.metadata ? JSON.stringify(memory.metadata) : null,
      memory.chunkIndex || 0,
      memory.tokenCount || 0,
      embeddingStr,
    ]
  );
}

/**
 * Elimina todos los chunks de un source_path
 */
export async function deleteBySource(sourcePath) {
  await pool.query("DELETE FROM memories WHERE source_path = $1", [sourcePath]);
}

export async function deprecateMemoryById(id, options = {}) {
  const result = await pool.query(
    `UPDATE memories
     SET status = 'deprecated',
         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
     WHERE id = $1
     RETURNING id, content, status, metadata`,
    [
      id,
      JSON.stringify({
        deprecated: {
          at: new Date().toISOString(),
          reason: options.reason || null,
          author: options.author || null,
        },
      }),
    ]
  );

  return result.rows[0] || null;
}

export async function updateMemoryById(id, updates) {
  const setClauses = [];
  const params = [id];

  function addSet(column, value, cast = "") {
    if (value === undefined) return;
    params.push(value);
    setClauses.push(`${column} = $${params.length}${cast}`);
  }

  addSet("content", updates.content);
  addSet("source_path", updates.sourcePath);
  addSet("organization", updates.organization);
  addSet("project", updates.project);
  addSet("repo_name", updates.repoName);
  addSet("memory_type", updates.memoryType);
  addSet("status", updates.status);
  addSet("criticality", updates.criticality);
  addSet("tags", updates.tags);
  addSet("last_verified_at", updates.lastVerifiedAt);
  addSet("token_count", updates.tokenCount);

  if (updates.embedding !== undefined) {
    addSet("embedding", `[${updates.embedding.join(",")}]`, "::vector");
  }

  if (updates.metadata) {
    params.push(JSON.stringify(updates.metadata));
    setClauses.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${params.length}::jsonb`);
  }

  if (setClauses.length === 0) return null;

  const result = await pool.query(
    `UPDATE memories
     SET ${setClauses.join(",\n         ")}
     WHERE id = $1
     RETURNING id, content, source_type, source_path, session_key,
               organization, project, repo_name, memory_type, status, criticality, tags,
               last_verified_at, created_at, metadata, chunk_index, token_count`,
    params
  );

  return result.rows[0] || null;
}

function addMemoryFilters(sqlParts, params, options) {
  const filters = [
    ["organization", options.organization],
    ["project", options.project],
    ["repo_name", options.repoName],
    ["memory_type", options.memoryType],
    ["status", options.status],
    ["criticality", options.criticality],
  ];

  for (const [column, value] of filters) {
    if (!value) continue;
    params.push(value);
    sqlParts.push(` AND ${column} = $${params.length}`);
  }

  if (options.tags && options.tags.length > 0) {
    params.push(options.tags);
    sqlParts.push(` AND tags && $${params.length}::text[]`);
  }
}

/**
 * Búsqueda por coseno — reemplaza la fuerza bruta en JS del artículo
 * En SQLite: cargaba TODOS los BLOBs y calculaba coseno en un loop JS
 * En PostgreSQL: el operador <=> hace coseno directo en el índice HNSW
 */
export async function queryByEmbedding(embedding, options = {}) {
  const limit = options.limit || 5;
  const types = options.types || null;
  const embeddingStr = `[${embedding.join(",")}]`;
  const queryText = options.queryText || "";

  let sql = `
    SELECT id, content, source_type, source_path, session_key,
           organization, project, repo_name, memory_type, status, criticality, tags, last_verified_at,
           created_at, metadata, chunk_index,
           1 - (embedding <=> $1::vector) AS similarity,
           CASE
             WHEN trim($2) = '' THEN 0
             ELSE ts_rank_cd(search_vector, websearch_to_tsquery('simple', $2))
           END AS text_rank,
           (
             (1 - (embedding <=> $1::vector)) * 0.75 +
             CASE
               WHEN trim($2) = '' THEN 0
               ELSE ts_rank_cd(search_vector, websearch_to_tsquery('simple', $2))
             END * 0.25
           ) AS hybrid_score
    FROM memories
    WHERE embedding IS NOT NULL
  `;
  const params = [embeddingStr, queryText];

  if (types && types.length > 0) {
    params.push(types);
    sql += ` AND source_type = ANY($${params.length})`;
  }

  const sqlParts = [];
  addMemoryFilters(sqlParts, params, options);
  sql += sqlParts.join("");

  sql += ` ORDER BY hybrid_score DESC, embedding <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Obtener memorias recientes (endpoint /recent del artículo)
 */
export async function getRecent(options = {}) {
  const limit = options.limit || 5;
  const types = options.types || null;

  let sql = `SELECT id, content, source_type, source_path, session_key,
                    organization, project, repo_name, memory_type, status, criticality, tags, last_verified_at,
                    created_at, metadata
             FROM memories WHERE 1=1`;
  const params = [];

  if (types && types.length > 0) {
    params.push(types);
    sql += ` AND source_type = ANY($${params.length})`;
  }

  const sqlParts = [];
  addMemoryFilters(sqlParts, params, options);
  sql += sqlParts.join("");

  params.push(limit);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Estadísticas (endpoint /stats del artículo)
 */
export async function getStats() {
  const total = await pool.query("SELECT COUNT(*) as count FROM memories");
  const withEmb = await pool.query(
    "SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL"
  );
  const byType = await pool.query(
    "SELECT source_type, COUNT(*) as count FROM memories GROUP BY source_type"
  );
  const dbSize = await pool.query(
    "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
  );

  return {
    total_chunks: parseInt(total.rows[0].count),
    with_embeddings: parseInt(withEmb.rows[0].count),
    db_size: dbSize.rows[0].size,
    by_type: Object.fromEntries(
      byType.rows.map((r) => [r.source_type, parseInt(r.count)])
    ),
  };
}

// --- Ingest log ---

export async function getIngestLog(sourcePath) {
  const r = await pool.query(
    "SELECT * FROM ingest_log WHERE source_path = $1",
    [sourcePath]
  );
  return r.rows[0] || null;
}

export async function upsertIngestLog(sourcePath, lastModified, chunkCount) {
  await pool.query(
    `INSERT INTO ingest_log (source_path, last_modified, last_ingested, chunk_count)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (source_path) DO UPDATE SET
       last_modified = EXCLUDED.last_modified,
       last_ingested = NOW(),
       chunk_count = EXCLUDED.chunk_count`,
    [sourcePath, lastModified, chunkCount]
  );
}

export default pool;
