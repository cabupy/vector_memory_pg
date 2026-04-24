// server.js — HTTP API (Node.js puro, sin Express)
// Fiel al artículo: solo escucha en localhost, sin auth.
// Endpoints: GET /query, GET /recent, GET /stats, POST /ingest

import { createServer } from "http";
import { URL } from "url";
import { execFileSync } from "child_process";
import dotenv from "dotenv";
import { initDb, getStats } from "./db.js";
import { searchMemories, recentMemories } from "./query.js";
import pool from "./db.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3010");
const HOST = process.env.HOST || "127.0.0.1";

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
  };
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;

  // CORS headers (por si el agente consulta desde otro proceso)
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
      return res.end(
        JSON.stringify({
          query: q,
          count: results.length,
          results,
        })
      );
    }

    // GET /recent?limit=5&types=session
    if (path === "/recent" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "5");
      const filters = readFilters(url.searchParams);

      const results = await recentMemories({ limit, ...filters });

      res.writeHead(200);
      return res.end(
        JSON.stringify({
          count: results.length,
          results,
        })
      );
    }

    // GET /stats
    if (path === "/stats" && req.method === "GET") {
      const stats = await getStats();
      res.writeHead(200);
      return res.end(JSON.stringify(stats));
    }

    // POST /ingest (trigger manual de ingesta)
    if (path === "/ingest" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;

      const payload = JSON.parse(body || "{}");
      const { path: filePath, type: sourceType } = payload;
      if (!filePath) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Campo 'path' requerido" }));
      }

      // Ingestar en background usando child_process
      const result = execFileSync(
        "node",
        ["src/ingest-one.js", filePath, sourceType || "session"],
        { encoding: "utf-8", timeout: 60000, env: buildIngestEnv(payload) }
      ).trim();

      res.writeHead(200);
      return res.end(JSON.stringify({ result }));
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
    console.log(`  GET  /recent?limit=5&types=session`);
    console.log(`  GET  /stats`);
    console.log(`  POST /ingest { "path": "<archivo>", "type": "session" }`);
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
