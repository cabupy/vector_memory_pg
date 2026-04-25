// ingest-one.js — Ingesta de un solo archivo
// Equivale a ingest-one.ts del artículo.
// Cada invocación: comprueba mtime → trocea → embebe → guarda → sale.
// Flags: --dry-run (simula sin guardar)
// Env:   INGEST_SECRET_MODE=block|redact (default: block)

import { readFile, stat } from "fs/promises";
import { basename, extname, join } from "path";
import { randomUUID } from "crypto";
import { homedir } from "os";
import dotenv from "dotenv";
dotenv.config({ path: join(homedir(), ".vector-memory.env") });
dotenv.config();
import {
  initDb,
  insertMemory,
  deleteBySource,
  getIngestLog,
  upsertIngestLog,
  insertSanitizationLog,
} from "./db.js";
import { embedBatch } from "./embeddings.js";
import { chunkSession, chunkMarkdown, estimateTokens } from "./chunker.js";
import pool from "./db.js";
import { getDeniedIngestReason, applySecretPolicy } from "./security.js";

function parseTags(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function ingestOne() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));
  const sourceType = args.filter((a) => !a.startsWith("--"))[1] || "session";
  const secretMode = process.env.INGEST_SECRET_MODE || "block";

  if (!filePath) {
    console.error("Uso: node src/ingest-one.js <archivo> <tipo> [--dry-run]");
    process.exit(1);
  }

  try {
    // Verificar denylist de paths
    const deniedReason = getDeniedIngestReason(filePath);
    if (deniedReason) {
      await initDb();
      await insertSanitizationLog({ filePath, action: "blocked_path", reason: deniedReason });
      throw new Error(deniedReason);
    }

    await initDb();

    // Comprobar si el archivo cambió (por mtime)
    const fileStat = await stat(filePath);
    const mtime = fileStat.mtime.toISOString();

    if (!dryRun) {
      const log = await getIngestLog(filePath);
      if (log && log.last_modified === mtime) {
        console.log("SKIP");
        await pool.end();
        return;
      }
    }

    // Leer contenido
    let content = await readFile(filePath, "utf-8");

    // Aplicar política de secretos (block o redact)
    const { content: safeContent, findings } = applySecretPolicy(content, filePath, secretMode);

    if (findings.length > 0) {
      const action = secretMode === "redact" ? "redacted" : "blocked_content";
      await insertSanitizationLog({ filePath, action, reason: `${findings.length} secreto(s) detectado(s)`, findings });
      if (secretMode === "block") {
        const summary = findings.slice(0, 5).map((f) => `${f.type} línea ${f.line}`).join(", ");
        throw new Error(`contenido bloqueado por posible secreto en ${filePath}: ${summary}`);
      }
      console.warn(`[Security] ${findings.length} secreto(s) redactado(s) en ${filePath}`);
    }

    content = safeContent;

    // Trocear
    let chunks;
    if (extname(filePath) === ".jsonl") {
      const messages = content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);
      const sessionKey = basename(filePath, ".jsonl");
      chunks = chunkSession(messages, sessionKey);
    } else {
      chunks = chunkMarkdown(content, filePath);
    }

    if (chunks.length === 0) {
      console.log("SKIP:empty");
      await pool.end();
      return;
    }

    // Modo dry-run: imprimir resumen y salir sin guardar
    if (dryRun) {
      console.log(JSON.stringify({
        dry_run: true,
        file: filePath,
        source_type: sourceType,
        secret_mode: secretMode,
        secrets_found: findings.length,
        secrets: findings,
        chunks: chunks.length,
        preview: chunks.slice(0, 3).map((c) => ({
          index: c.index,
          tokens: estimateTokens(c.content),
          preview: c.content.slice(0, 120).replace(/\n/g, " "),
        })),
      }, null, 2));
      await pool.end();
      return;
    }

    // Eliminar chunks anteriores de este archivo
    await deleteBySource(filePath);

    // Generar embeddings en batch
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedBatch(texts);

    // Guardar en PostgreSQL
    const createdAt = fileStat.mtime.toISOString();
    const baseMetadata = {
      organization: process.env.MEMORY_ORGANIZATION || null,
      project: process.env.MEMORY_PROJECT || null,
      repoName: process.env.MEMORY_REPO_NAME || null,
      memoryType: process.env.MEMORY_TYPE || sourceType,
      status: process.env.MEMORY_STATUS || "active",
      criticality: process.env.MEMORY_CRITICALITY || "normal",
      tags: parseTags(process.env.MEMORY_TAGS),
    };

    for (let i = 0; i < chunks.length; i++) {
      await insertMemory({
        id: `${basename(filePath)}_chunk_${i}_${randomUUID().slice(0, 8)}`,
        content: chunks[i].content,
        sourceType,
        sourcePath: filePath,
        sessionKey: chunks[i].sessionKey || null,
        ...baseMetadata,
        createdAt,
        chunkIndex: chunks[i].index,
        tokenCount: estimateTokens(chunks[i].content),
        embedding: embeddings[i],
      });
    }

    // Actualizar ingest_log
    await upsertIngestLog(filePath, mtime, chunks.length);

    console.log(`OK:${chunks.length} chunks`);
    await pool.end();
  } catch (err) {
    console.error(`ERROR:${err.message}`);
    await pool.end();
    process.exit(1);
  }
}

ingestOne();
