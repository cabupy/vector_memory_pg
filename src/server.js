// server.js — HTTP API (Node.js puro, sin Express)
// Fiel al artículo: solo escucha en localhost, sin auth.
// Endpoints: GET /query, GET /recent, GET /stats, POST /ingest
//            POST /events/session-start, POST /events/post-tool-use, POST /events/session-end

import { createServer } from "http";
import { URL } from "url";
import { execFileSync } from "child_process";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initDb, getStats, getSanitizationLog } from "./db.js";
import { searchMemories, recentMemories, saveSessionSummary, searchMemoriesCompact, getMemories, memoryTimeline } from "./query.js";
import pool from "./db.js";
import { getDeniedIngestReason } from "./security.js";
import { applyContentPolicy } from "./content-policy.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || "3010");
const HOST = process.env.HOST || "127.0.0.1";

// ─── Config de proyecto (.vector-memory.json) ─────────────────────────────────

async function loadProjectConfig() {
  // Buscar primero en CWD, luego en directorio de instalación
  const candidates = [
    join(process.cwd(), ".vector-memory.json"),
    join(__dirname, "..", ".vector-memory.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const raw = await readFile(p, "utf-8");
        return JSON.parse(raw);
      } catch { /* ignorar */ }
    }
  }
  return {};
}

// ─── Sesiones activas (en memoria) ────────────────────────────────────────────
// Map<session_id, { startedAt, project, organization, repo_name, observations[] }>

const activeSessions = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseList(value) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : null;
}

function readFilters(searchParams) {
  return {
    types: parseList(searchParams.get("types")),
    organization: searchParams.get("organization") || null,
    project: searchParams.get("project") || null,
    repoName: searchParams.get("repo_name") || null,
    memoryType: searchParams.get("memory_type") || null,
    status: searchParams.get("status") || null,
    criticality: searchParams.get("criticality") || null,
    tags: parseList(searchParams.get("tags")),
  };
}

function buildIngestEnv(body) {
  return {
    ...process.env,
    MEMORY_ORGANIZATION: body.organization || "",
    MEMORY_PROJECT: body.project || "",
    MEMORY_REPO_NAME: body.repo_name || "",
    MEMORY_TYPE: body.memory_type || body.type || "",
    MEMORY_STATUS: body.status || "active",
    MEMORY_CRITICALITY: body.criticality || "normal",
    MEMORY_TAGS: Array.isArray(body.tags) ? body.tags.join(",") : body.tags || "",
    INGEST_SECRET_MODE: body.secret_mode || process.env.INGEST_SECRET_MODE || "block",
  };
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

// ─── Manejador principal ───────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // GET /query?q=<texto>&limit=5&types=session,daily
    if (path === "/query" && req.method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Parámetro 'q' requerido" }));
      }

      const limit = parseInt(url.searchParams.get("limit") || "5");
      const filters = readFilters(url.searchParams);

      const results = await searchMemories(q, { limit, ...filters });

      res.writeHead(200);
      return res.end(JSON.stringify({ query: q, count: results.length, results }));
    }

    // GET /recent?limit=5&types=session
    if (path === "/recent" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "5");
      const filters = readFilters(url.searchParams);

      const results = await recentMemories({ limit, ...filters });

      res.writeHead(200);
      return res.end(JSON.stringify({ count: results.length, results }));
    }

    // GET /stats
    if (path === "/stats" && req.method === "GET") {
      const stats = await getStats();
      res.writeHead(200);
      return res.end(JSON.stringify(stats));
    }

    // GET /sanitization-log?limit=50&file_path=<path>
    if (path === "/sanitization-log" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const filePath = url.searchParams.get("file_path") || null;
      const rows = await getSanitizationLog({ limit, filePath });
      res.writeHead(200);
      return res.end(JSON.stringify({ count: rows.length, results: rows }));
    }

    // GET /query/compact?q=<texto>&limit=5  — salida reducida para context window
    if (path === "/query/compact" && req.method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Parámetro 'q' requerido" }));
      }
      const limit = parseInt(url.searchParams.get("limit") || "5");
      const filters = readFilters(url.searchParams);
      const results = await searchMemoriesCompact(q, { limit, ...filters });
      res.writeHead(200);
      return res.end(JSON.stringify({ query: q, count: results.length, results }));
    }

    // GET /memories?ids=id1,id2,id3  — fetch por IDs o public_ids
    if (path === "/memories" && req.method === "GET") {
      const idsParam = url.searchParams.get("ids");
      if (!idsParam) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Parámetro 'ids' requerido (separados por coma)" }));
      }
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const results = await getMemories(ids);
      res.writeHead(200);
      return res.end(JSON.stringify({ count: results.length, results }));
    }

    // GET /timeline?project=<p>&limit=50&from=2026-01-01&to=2026-12-31
    if (path === "/timeline" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const from  = url.searchParams.get("from") || null;
      const to    = url.searchParams.get("to")   || null;
      const filters = readFilters(url.searchParams);
      const groups = await memoryTimeline({ limit, from, to, ...filters });
      res.writeHead(200);
      return res.end(JSON.stringify({ days: groups.length, timeline: groups }));
    }

    // POST /ingest
    if (path === "/ingest" && req.method === "POST") {
      const payload = await readBody(req);
      const { path: filePath, type: sourceType } = payload;
      if (!filePath) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Campo 'path' requerido" }));
      }

      const deniedReason = getDeniedIngestReason(filePath);
      if (deniedReason) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: deniedReason }));
      }

      const ingestArgs = ["src/ingest-one.js", filePath, sourceType || "session"];
      if (payload.dry_run) ingestArgs.push("--dry-run");

      const result = execFileSync(
        "node",
        ingestArgs,
        { encoding: "utf-8", timeout: 60000, env: buildIngestEnv(payload) }
      ).trim();

      let parsed;
      try { parsed = JSON.parse(result); } catch { parsed = null; }

      res.writeHead(200);
      return res.end(JSON.stringify(parsed ?? { result }));
    }

    // ── Eventos de sesión ─────────────────────────────────────────────────────

    // POST /events/session-start
    // body: { session_id, project?, organization?, repo_name?, query? }
    // Responde con contexto de memorias relevantes si está configurado.
    if (path === "/events/session-start" && req.method === "POST") {
      const body = await readBody(req);
      const { session_id } = body;

      if (!session_id) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Campo 'session_id' requerido" }));
      }

      const session = {
        startedAt: new Date().toISOString(),
        project: body.project || null,
        organization: body.organization || null,
        repoName: body.repo_name || null,
        observations: [],
      };
      activeSessions.set(session_id, session);

      // Context injection: buscar memorias relevantes si está habilitado
      const cfg = await loadProjectConfig();
      const ci = cfg.contextInjection || {};
      let context = [];

      if (ci.enabled !== false) {
        const query = body.query
          || (body.project ? `memories for project ${body.project}` : null)
          || (body.repo_name ? `memories for repo ${body.repo_name}` : null);

        if (query) {
          const limit = ci.limit ?? 5;
          const filters = {
            project: body.project || null,
            organization: body.organization || null,
            repoName: body.repo_name || null,
            status: "active",
          };
          context = await searchMemories(query, { limit, ...filters });
        }
      }

      console.log(`[Events] session-start: ${session_id} (project=${session.project || "-"})`);

      res.writeHead(200);
      return res.end(JSON.stringify({
        session_id,
        started_at: session.startedAt,
        context_count: context.length,
        context,
      }));
    }

    // POST /events/post-tool-use
    // body: { session_id, tool_name, tool_input?, observation?, auto_save? }
    // Si observation está presente y auto_save !== false, guarda como memoria.
    if (path === "/events/post-tool-use" && req.method === "POST") {
      const body = await readBody(req);
      const { session_id, tool_name, observation } = body;

      if (!session_id) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Campo 'session_id' requerido" }));
      }

      const session = activeSessions.get(session_id);
      if (!session) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: `Sesión no encontrada: ${session_id}` }));
      }

      let saved = false;
      let savedId = null;

      if (observation && body.auto_save !== false) {
        const clean = applyContentPolicy(observation);
        if (clean) {
          session.observations.push({ tool: tool_name, at: new Date().toISOString(), text: clean });

          const memory = await saveSessionSummary({
            content: clean,
            sessionKey: session_id,
            project: session.project,
            organization: session.organization,
            repoName: session.repoName,
            memoryType: "observation",
            tags: ["tool-use", tool_name].filter(Boolean),
          });

          saved = true;
          savedId = memory.id;
        }
      }

      res.writeHead(200);
      return res.end(JSON.stringify({ session_id, saved, id: savedId }));
    }

    // POST /events/session-end
    // body: { session_id, summary?, auto_save? }
    // Guarda el resumen de la sesión como memoria y elimina la sesión activa.
    if (path === "/events/session-end" && req.method === "POST") {
      const body = await readBody(req);
      const { session_id } = body;

      if (!session_id) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Campo 'session_id' requerido" }));
      }

      const session = activeSessions.get(session_id);

      let saved = false;
      let savedId = null;

      const summaryText = body.summary;
      if (summaryText && body.auto_save !== false) {
        const clean = applyContentPolicy(summaryText);
        if (clean) {
          const memory = await saveSessionSummary({
            content: clean,
            sessionKey: session_id,
            project: session?.project || null,
            organization: session?.organization || null,
            repoName: session?.repoName || null,
            memoryType: "session_summary",
            tags: ["session-end"],
          });
          saved = true;
          savedId = memory.id;
        }
      }

      activeSessions.delete(session_id);
      console.log(`[Events] session-end: ${session_id} (saved=${saved})`);

      res.writeHead(200);
      return res.end(JSON.stringify({
        session_id,
        saved,
        id: savedId,
        observations_count: session?.observations?.length ?? 0,
      }));
    }

    // GET /events/sessions — lista sesiones activas (debug/monitoring)
    if (path === "/events/sessions" && req.method === "GET") {
      const sessions = [];
      for (const [id, s] of activeSessions.entries()) {
        sessions.push({
          session_id: id,
          started_at: s.startedAt,
          project: s.project,
          organization: s.organization,
          repo_name: s.repoName,
          observations: s.observations.length,
        });
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ count: sessions.length, sessions }));
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error("[Server] Error:", err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function start() {
  await initDb();
  console.log("[DB] PostgreSQL conectado y schema listo");

  const server = createServer(handleRequest);

  server.listen(PORT, HOST, () => {
    console.log(`[Server] Escuchando en http://${HOST}:${PORT}`);
    console.log(`[Server] Endpoints:`);
    console.log(`  GET  /query?q=<texto>&limit=5&types=session,daily`);
    console.log(`  GET  /query/compact?q=<texto>&limit=5`);
    console.log(`  GET  /memories?ids=id1,id2,id3`);
    console.log(`  GET  /timeline?project=<p>&limit=50&from=YYYY-MM-DD`);
    console.log(`  GET  /recent?limit=5&types=session`);
    console.log(`  GET  /stats`);
    console.log(`  POST /ingest { "path": "<archivo>", "type": "session" }`);
    console.log(`  POST /events/session-start { "session_id": "...", "project": "..." }`);
    console.log(`  POST /events/post-tool-use { "session_id": "...", "tool_name": "...", "observation": "..." }`);
    console.log(`  POST /events/session-end   { "session_id": "...", "summary": "..." }`);
    console.log(`  GET  /events/sessions`);
  });

  process.on("SIGINT", async () => {
    console.log("\n[Server] Cerrando...");
    server.close();
    await pool.end();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error("[Server] Fatal:", err.message);
  process.exit(1);
});
