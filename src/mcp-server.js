// mcp-server.js — Servidor MCP para memoria vectorial
// Expone search_memories, recent_memories e ingest_file como herramientas MCP
// Comunicación: stdio (JSON-RPC 2.0), compatible con Claude Code y OpenClaw

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { homedir } from "os";

// Orden de prioridad: vars de shell > ~/.vector-memory.env > .env del paquete
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(homedir(), ".vector-memory.env") });
dotenv.config({ path: resolve(__dirname, "../.env") });

import { initDb, getStats } from "./db.js";
import {
  searchMemories,
  recentMemories,
  saveMemory,
  saveSessionSummary,
  deprecateMemory,
  updateMemory,
  verifyMemory,
  getMemories,
  searchMemoriesCompact,
  memoryTimeline,
  reflectMemories,
} from "./query.js";
import pool from "./db.js";
import { applyContentPolicy } from "./content-policy.js";

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

const memoryMetadataSchema = {
  organization: z.string().optional().describe("Organización de la memoria"),
  project: z.string().optional().describe("Proyecto de la memoria"),
  repo_name: z.string().optional().describe("Repo asociado a la memoria"),
  memory_type: z.string().optional().describe("Tipo de memoria: decision, security, architecture, bug, etc."),
  status: z.string().optional().describe("Estado de vigencia: active, deprecated, superseded, archived"),
  criticality: z.string().optional().describe("Criticidad: low, normal, high, critical"),
  tags: z.array(z.string()).optional().describe("Tags para clasificar la memoria"),
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

function normalizeMetadata(args) {
  return {
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
    memory.last_verified_at ? `verified ${formatDate(memory.last_verified_at)}` : null,
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

// --- Herramienta: save_memory ---

server.tool(
  "save_memory",
  "Guarda una memoria técnica persistente con embedding y metadata para recuperarla luego por búsqueda semántica.",
  {
    content: z.string().min(1).describe("Contenido de la memoria a guardar"),
    author: z.string().optional().describe("Autor humano o agente que originó la memoria"),
    source_path: z.string().optional().describe("Fuente lógica o archivo relacionado"),
    auto_classify: z.boolean().optional().describe("Si true, usa IA para sugerir memory_type, criticality y tags automáticamente"),
    ...memoryMetadataSchema,
  },
  async (args) => {
    const clean = applyContentPolicy(args.content);

    if (!clean) {
      return {
        content: [{ type: "text", text: "Memoria omitida por política de contenido (@no-memory o contenido vacío tras redactar <private>)." }],
      };
    }

    const memory = await saveMemory({
      content: clean,
      author: args.author,
      sourcePath: args.source_path,
      autoClassify: args.auto_classify ?? false,
      ...normalizeMetadata(args),
    });

    const classifiedNote = memory.classification_source === "auto"
      ? ` [auto-clasificado: ${memory.memory_type} / ${memory.criticality} / tags: ${memory.tags.join(", ")}]`
      : "";

    return {
      content: [
        {
          type: "text",
          text: `Memoria guardada: ${memory.id}${classifiedNote}`,
        },
      ],
    };
  }
);

// --- Herramienta: save_session_summary ---

server.tool(
  "save_session_summary",
  "Guarda el resumen o puntos clave de la sesión actual como memoria persistente. Llamar al final de cada sesión de trabajo.",
  {
    summary: z.string().min(1).describe("Resumen de la sesión o puntos clave a recordar"),
    session_id: z.string().optional().describe("Identificador de la sesión (opcional, para trazabilidad)"),
    author: z.string().optional().describe("Agente o usuario que genera el resumen"),
    ...memoryMetadataSchema,
  },
  async (args) => {
    const clean = applyContentPolicy(args.summary);

    if (!clean) {
      return {
        content: [{ type: "text", text: "Resumen omitido por política de contenido (@no-memory o vacío tras redactar <private>)." }],
      };
    }

    const memory = await saveSessionSummary({
      content: clean,
      sessionKey: args.session_id || null,
      author: args.author,
      source: "mcp",
      memoryType: "session_summary",
      ...normalizeMetadata(args),
    });

    return {
      content: [
        {
          type: "text",
          text: `Resumen de sesión guardado: ${memory.id}`,
        },
      ],
    };
  }
);

// --- Herramienta: deprecate_memory ---

server.tool(
  "deprecate_memory",
  "Marca una memoria existente como deprecated sin eliminarla, registrando motivo y autor en metadata.",
  {
    id: z.string().min(1).describe("ID de la memoria a deprecar"),
    reason: z.string().optional().describe("Motivo por el que la memoria queda obsoleta"),
    author: z.string().optional().describe("Autor humano o agente que depreca la memoria"),
  },
  async ({ id, reason, author }) => {
    const memory = await deprecateMemory(id, { reason, author });

    if (!memory) {
      return {
        content: [{ type: "text", text: `No existe memoria con id: ${id}` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Memoria deprecada: ${memory.id}`,
        },
      ],
    };
  }
);

// --- Herramienta: update_memory ---

server.tool(
  "update_memory",
  "Actualiza una memoria existente. Si cambia el contenido, recalcula el embedding.",
  {
    id: z.string().min(1).describe("ID de la memoria a actualizar"),
    content: z.string().optional().describe("Nuevo contenido de la memoria"),
    author: z.string().optional().describe("Autor humano o agente que actualiza la memoria"),
    reason: z.string().optional().describe("Motivo de la actualización"),
    source_path: z.string().optional().describe("Nueva fuente lógica o archivo relacionado"),
    ...memoryMetadataSchema,
  },
  async (args) => {
    const hasContent = Boolean(args.content && args.content.trim());
    const hasMetadata = [
      args.source_path,
      args.organization,
      args.project,
      args.repo_name,
      args.memory_type,
      args.status,
      args.criticality,
    ].some(Boolean) || (args.tags && args.tags.length > 0);

    if (!hasContent && !hasMetadata) {
      return {
        content: [{ type: "text", text: "No hay cambios para aplicar." }],
      };
    }

    const memory = await updateMemory(args.id, {
      content: hasContent ? args.content : undefined,
      author: args.author,
      reason: args.reason,
      sourcePath: args.source_path,
      ...normalizeMetadata(args),
    });

    if (!memory) {
      return {
        content: [{ type: "text", text: `No existe memoria con id: ${args.id}` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Memoria actualizada: ${memory.id}`,
        },
      ],
    };
  }
);

// --- Herramienta: verify_memory ---

server.tool(
  "verify_memory",
  "Marca una memoria como verificada ahora, registrando auditoría en metadata.",
  {
    id: z.string().min(1).describe("ID de la memoria a verificar"),
    author: z.string().optional().describe("Autor humano o agente que verifica la memoria"),
    note: z.string().optional().describe("Nota opcional sobre la verificación"),
  },
  async ({ id, author, note }) => {
    const memory = await verifyMemory(id, { author, note });

    if (!memory) {
      return {
        content: [{ type: "text", text: `No existe memoria con id: ${id}` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Memoria verificada: ${memory.id}`,
        },
      ],
    };
  }
);

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

// --- Herramienta: search_memories_compact ---

server.tool(
  "search_memories_compact",
  "Búsqueda semántica con salida reducida (snippet 150 chars). Ideal para consultas rápidas sin saturar el context window.",
  {
    query: z.string().describe("Texto de búsqueda en lenguaje natural"),
    limit: z.number().int().min(1).max(20).optional().default(5)
      .describe("Número máximo de resultados (default: 5)"),
    ...memoryFiltersSchema,
  },
  async (args) => {
    const results = await searchMemoriesCompact(args.query, {
      limit: args.limit,
      ...normalizeFilters(args),
    });

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `Sin resultados para: "${args.query}"` }],
      };
    }

    const formatted = results
      .map((r, i) =>
        `[${i + 1}] ${r.public_id || r.id} | score:${r.score} | ${r.memory_type || r.source_type} | ${r.project || "-"}\n${r.snippet}`
      )
      .join("\n---\n");

    return {
      content: [{ type: "text", text: formatted }],
    };
  }
);

// --- Herramienta: get_memories ---

server.tool(
  "get_memories",
  "Recupera memorias completas por lista de IDs o public_ids (VM-000123). Útil para expandir resultados de search_memories_compact.",
  {
    ids: z.array(z.string()).min(1).max(20)
      .describe("Lista de IDs o public_ids (VM-XXXXXX) a recuperar"),
  },
  async ({ ids }) => {
    const results = await getMemories(ids);

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No se encontraron memorias para los IDs indicados." }],
      };
    }

    const formatted = results
      .map((r) =>
        `[${r.public_id || r.id}] ${r.memory_type || r.source_type} | ${r.project || "-"} | ${formatDate(r.created_at)}\n${r.content}`
      )
      .join("\n\n---\n\n");

    return {
      content: [{ type: "text", text: formatted }],
    };
  }
);

// --- Herramienta: memory_timeline ---

server.tool(
  "memory_timeline",
  "Historial cronológico de memorias agrupado por fecha. Útil para revisar qué se trabajó en un período.",
  {
    limit: z.number().int().min(1).max(200).optional().default(50)
      .describe("Máximo de memorias a incluir (default: 50)"),
    from: z.string().optional().describe("Fecha inicio ISO (YYYY-MM-DD)"),
    to:   z.string().optional().describe("Fecha fin ISO (YYYY-MM-DD)"),
    ...memoryFiltersSchema,
  },
  async (args) => {
    const groups = await memoryTimeline({
      limit: args.limit,
      from: args.from || null,
      to:   args.to   || null,
      ...normalizeFilters(args),
    });

    if (groups.length === 0) {
      return {
        content: [{ type: "text", text: "Sin memorias en el período indicado." }],
      };
    }

    const formatted = groups
      .map(({ date, count, memories }) => {
        const items = memories
          .map((m) => `  • [${m.public_id || m.id}] ${m.memory_type || m.source_type} | ${m.project || "-"} | ${m.snippet}`)
          .join("\n");
        return `## ${date} (${count})\n${items}`;
      })
      .join("\n\n");

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

// --- Herramienta: reflect_memories ---

server.tool(
  "reflect_memories",
  "Analiza memorias activas de un proyecto o repo para detectar contradicciones, redundancias y oportunidades de consolidación. Usa IA para razonar sobre el conjunto de memorias. No modifica nada: solo sugiere acciones.",
  {
    project: z.string().optional().describe("Proyecto a analizar"),
    organization: z.string().optional().describe("Organización"),
    repo_name: z.string().optional().describe("Repositorio a analizar"),
    focus: z.string().optional().describe("Tema de análisis (e.g. 'security', 'architecture', 'deployment')"),
    memory_type: z.string().optional().describe("Filtrar por tipo de memoria"),
    limit: z.number().optional().describe("Máximo de memorias a analizar (default 30, max 60)"),
  },
  async (args) => {
    try {
      const result = await reflectMemories({
        project: args.project,
        organization: args.organization,
        repo_name: args.repo_name,
        focus: args.focus,
        memory_type: args.memory_type,
        limit: args.limit,
      });

      const lines = [
        `## Análisis de ${result.analyzed_count} memorias`,
        result.scope.repo_name ? `Repo: ${result.scope.repo_name}` : null,
        result.scope.project   ? `Proyecto: ${result.scope.project}` : null,
        result.scope.focus     ? `Foco: ${result.scope.focus}` : null,
        "",
        `**Resumen:** ${result.summary}`,
      ].filter((l) => l !== null);

      if (result.findings.length > 0) {
        lines.push("", `**Hallazgos (${result.findings.length}):**`);
        for (const f of result.findings) {
          lines.push(`- [${f.type}] ${f.description}`);
          lines.push(`  IDs afectados: ${f.memory_ids?.join(", ") ?? "-"}`);
          lines.push(`  Acción sugerida: ${f.suggested_action}`);
        }
      }

      if (result.suggested_new_memories.length > 0) {
        lines.push("", `**Memorias nuevas sugeridas (${result.suggested_new_memories.length}):**`);
        for (const m of result.suggested_new_memories) {
          lines.push(`- [${m.memory_type} / ${m.criticality}] ${m.content}`);
        }
      }

      if (result.suggested_deprecations.length > 0) {
        lines.push("", `**Deprecaciones sugeridas:** ${result.suggested_deprecations.join(", ")}`);
      }

      if (result.findings.length === 0 && result.suggested_new_memories.length === 0 && result.suggested_deprecations.length === 0) {
        lines.push("", "No se detectaron problemas. La base de conocimiento parece consistente.");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error al analizar memorias: ${err.message}` }] };
    }
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
