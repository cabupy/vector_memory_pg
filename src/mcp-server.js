// mcp-server.js — Servidor MCP para memoria vectorial
// Expone search_memories, recent_memories e ingest_file como herramientas MCP
// Comunicación: stdio (JSON-RPC 2.0), compatible con Claude Code y OpenClaw

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Cargar .env desde la raíz del proyecto
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

import { initDb, getStats } from "./db.js";
import { searchMemories, recentMemories } from "./query.js";
import pool from "./db.js";

const memoryFiltersSchema = {
  types: z
    .array(z.enum(["session", "daily", "memory", "docs", "brain"]))
    .optional()
    .describe("Filtrar por source_type. Si se omite, busca en todos."),
  organization: z.string().optional().describe("Filtrar por organización"),
  project: z.string().optional().describe("Filtrar por proyecto"),
  repo_name: z.string().optional().describe("Filtrar por repo"),
  memory_type: z.string().optional().describe("Filtrar por tipo de memoria"),
  status: z.string().optional().describe("Filtrar por estado: active, deprecated, superseded, archived"),
  criticality: z.string().optional().describe("Filtrar por criticidad"),
  tags: z.array(z.string()).optional().describe("Filtrar por tags"),
};

function normalizeFilters(args) {
  return {
    types: args.types,
    organization: args.organization,
    project: args.project,
    repoName: args.repo_name,
    memoryType: args.memory_type,
    status: args.status,
    criticality: args.criticality,
    tags: args.tags,
  };
}

function formatContext(memory) {
  return [
    memory.organization,
    memory.project,
    memory.repo_name,
    memory.memory_type,
    memory.status,
    memory.criticality,
  ]
    .filter(Boolean)
    .join(" / ");
}

function formatDate(value) {
  return value ? value.slice(0, 10) : "sin fecha";
}

// --- Inicializar servidor MCP ---

const server = new McpServer({
  name: "vector-memory",
  version: "1.0.0",
});

// --- Herramienta: search_memories ---

server.tool(
  "search_memories",
  "Busca memorias relevantes por similitud semántica en el historial de sesiones, notas diarias y documentos técnicos de Karai.",
  {
    query: z.string().describe("Texto de búsqueda en lenguaje natural"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Número máximo de resultados (default: 5)"),
    ...memoryFiltersSchema,
  },
  async (args) => {
    const { query, limit } = args;
    const results = await searchMemories(query, {
      limit,
      ...normalizeFilters(args),
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No se encontraron memorias relevantes para: "${query}"`,
          },
        ],
      };
    }

    const formatted = results
      .map(
        (r, i) =>
          `[${i + 1}] Score: ${r.score} | Tipo: ${r.source_type} | Contexto: ${formatContext(r) || "sin metadata"} | Fecha: ${formatDate(r.created_at)}\n${r.content}`
      )
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text",
          text: `${results.length} resultado(s) para "${query}":\n\n${formatted}`,
        },
      ],
    };
  }
);

// --- Herramienta: recent_memories ---

server.tool(
  "recent_memories",
  "Obtiene las memorias más recientes sin búsqueda semántica. Útil para ver qué se trabajó últimamente.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Número máximo de resultados (default: 5)"),
    ...memoryFiltersSchema,
  },
  async (args) => {
    const { limit } = args;
    const results = await recentMemories({
      limit,
      ...normalizeFilters(args),
    });

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No hay memorias recientes." }],
      };
    }

    const formatted = results
      .map(
        (r, i) =>
          `[${i + 1}] Tipo: ${r.source_type} | Contexto: ${formatContext(r) || "sin metadata"} | Fecha: ${formatDate(r.created_at)}\n${r.content.slice(0, 300)}...`
      )
      .join("\n\n---\n\n");

    return {
      content: [{ type: "text", text: formatted }],
    };
  }
);

// --- Herramienta: memory_stats ---

server.tool(
  "memory_stats",
  "Devuelve estadísticas de la memoria vectorial: total de chunks, distribución por tipo y tamaño de la DB.",
  {},
  async () => {
    const stats = await getStats();
    const text = [
      `Total chunks: ${stats.total_chunks}`,
      `Con embeddings: ${stats.with_embeddings}`,
      `Tamaño DB: ${stats.db_size}`,
      `Por tipo: ${JSON.stringify(stats.by_type, null, 2)}`,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
    };
  }
);

// --- Arrancar servidor ---

async function main() {
  await initDb();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP usa stdio — no loguear a stdout para no corromper el protocolo
  process.stderr.write("[MCP] vector-memory server iniciado\n");

  process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[MCP] Error fatal: ${err.message}\n`);
  process.exit(1);
});
