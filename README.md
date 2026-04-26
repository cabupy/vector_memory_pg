# vector-memory-pg

![vector-memory-pg](https://raw.githubusercontent.com/cabupy/vector_memory_pg/main/assets/images/banner-3.png)

**Memoria técnica institucional para agentes IA** —
PostgreSQL + pgvector + OpenAI embeddings + HTTP API + MCP + UI web.

[Instalación](./docs/installation.md) •
[CLI](./docs/cli.md) •
[HTTP API](./docs/http-api.md) •
[MCP](./docs/mcp.md) •
[Seguridad](./docs/security.md) •
[Arquitectura](./docs/architecture.md) •
[Contribuir](./CONTRIBUTING.md)

---

Tu agente olvida todo al terminar la sesión. `vector-memory-pg` le da memoria.

Una base de conocimiento técnico consultable: decisiones de arquitectura,
bugs conocidos, convenciones, restricciones y sesiones de trabajo.
Separada por organización, proyecto y repositorio.
Con control de vigencia, criticidad y búsqueda híbrida semántica + full-text.

Funciona desde **cualquier directorio** sin interferir con las variables
de entorno de otros proyectos.

## Instalación

```bash
npm install -g vector-memory-pg
vector-memory quickstart      # configuración guiada: DB, .env, schema
vector-memory worker --open   # levanta el server y abre la UI en el browser
```

O con Docker (sin necesitar PostgreSQL local):

```bash
docker compose up -d          # levanta PostgreSQL 17 + pgvector en :5433
vector-memory quickstart
vector-memory worker --open
```

## Bring Your Own Coding Agent

Funciona con cualquier agente IA que soporte MCP. Un comando configura todo:

```bash
vector-memory init --tools claude-code    # o cursor, codex, opencode, openclaw
```

Eso ejecuta en un solo paso: crea `.vector-memory.json`, instala las instrucciones
de uso en el archivo de config del agente, instala slash commands (donde aplica)
y muestra el snippet de config MCP.

| Agente | Instrucciones | Slash commands | Config MCP |
|---|---|---|---|
| Claude Code | `CLAUDE.md` | `.claude/commands/vm-*.md` | `~/.claude/mcp.json` |
| OpenCode | `AGENTS.md` | `.opencode/commands/vm-*.md` | `.opencode/config.json` |
| Cursor | `.cursor/rules/vector-memory.mdc` | — | Settings → MCP |
| Codex | `AGENTS.md` | — | `~/.codex/config.yaml` |
| OpenClaw | `AGENTS.md` | `.opencode/commands/vm-*.md` | según config |

Slash commands disponibles: `/vm-context`, `/vm-search`, `/vm-save`, `/vm-reflect`, `/vm-iterate`

```bash
# Instalar solo las instrucciones de uso
vector-memory skills install --target opencode

# Instalar solo los slash commands
vector-memory commands install --target claude-code

# Combinar múltiples agentes
vector-memory init --tools claude-code,cursor
```

Ver guías detalladas en [docs/integrations/](./docs/integrations/).

## Ciclo completo

```
1. Guardar      save_memory / POST /memories
                → decisiones, bugs, patrones, restricciones

2. Buscar       search_memories / vector-memory search
                → híbrida: semántica (70%) + full-text (20%)

3. Timeline     memory_timeline / GET /timeline / UI Timeline
                → historial cronológico agrupado por día

4. Reflexionar  reflect_memories / POST /reflect / UI Reflect
                → detecta contradicciones, duplicados y gaps con IA
                → devuelve sugerencias sin modificar nada

5. Deprecar     deprecate_memory / POST /memories/:id/deprecate
                → botón Deprecar en UI Reflect aplica sugerencias

6. Concluir     save_session_summary / POST /events/session-end
                → persiste el resumen de la sesión al finalizar
```

## UI Web

Interfaz web local accesible en `http://localhost:3010/ui`:

- **Search** — búsqueda semántica con filtros de estado, tipo y límite
- **Recientes** — últimas N memorias ordenadas por fecha
- **Timeline** — historial agrupado por día con rango configurable
- **Stats** — totales, tamaño de DB y distribución por tipo
- **Reflect** — analiza memorias con IA; detecta contradicciones y gaps;
  botones para deprecar o guardar sugerencias directamente

```bash
vector-memory worker --open   # inicia server y abre el browser automáticamente
```

## Arquitectura

```text
Agente (Claude Code / OpenCode / Cursor)
        |
        |-- MCP (stdio)          save_memory, search_memories, reflect_memories ...
        |-- HTTP API (:3010)     GET /query, POST /reflect, /events/session-*
        `-- CLI                  vector-memory search, ingest, doctor ...
                |
                v
        PostgreSQL + pgvector
                |-- vector(1536) + HNSW   (búsqueda semántica)
                |-- tsvector + GIN        (full-text)
                `-- metadata + vigencia + criticidad
                        |
                        v
                OpenAI text-embedding-3-small
```

## Características

**Búsqueda**

- Híbrida: similitud vectorial (70%) + PostgreSQL Full-Text Search (20%)
- Boosts por criticidad, estado y fecha de verificación
- `search_memories_compact` — salida reducida para minimizar context window
- `get_memories` — recupera memorias completas por lista de IDs
- `memory_timeline` — historial cronológico agrupado por fecha

**Escritura desde MCP**

- `save_memory` — guarda decisiones, bugs, patrones, restricciones;
  acepta `auto_classify: true` para inferir tipo, criticidad y tags con IA
- `save_session_summary` — resumen de sesión al finalizar
- `update_memory`, `deprecate_memory`, `verify_memory`

**Análisis con IA (Reflect)**

- `reflect_memories` — analiza memorias recientes con gpt-4o-mini
- Detecta contradicciones, duplicados y gaps en el conocimiento acumulado
- Devuelve hallazgos, memorias sugeridas y deprecaciones sugeridas
- **Solo sugiere; nunca modifica nada**
- La UI Reflect permite aplicar cada sugerencia con un solo clic

**Ciclo de vida de sesión**

- `POST /events/session-start` — inyecta contexto relevante al iniciar
- `POST /events/post-tool-use` — guarda observaciones automáticamente
- `POST /events/session-end` — persiste el resumen de la sesión

**Metadatos y vigencia**

- Separación por `organization`, `project`, `repo_name`, `memory_type`
- Estados: `active`, `deprecated`, `superseded`, `archived`
- Criticidad: `low`, `normal`, `high`, `critical`
- `public_id` legible: `VM-000001`, `VM-000042`...

**Seguridad e ingesta**

- Denylist de paths + detector de 8 patrones de secretos
- Modos `block` (default) y `redact`
- Dry-run y log de sanitización auditable
- Ingesta incremental de Markdown y JSONL con detección por `mtime`

**Configuración aislada**

- `VECTOR_MEMORY_DATABASE_URL` — var dedicada que no colisiona con otros proyectos
- `~/.vector-memory.env` — config global de usuario, aplica desde cualquier directorio
- Content policy: `@no-memory` omite una memoria,
  `<private>...</private>` redacta bloques sensibles

## Configuración rápida

```bash
# ~/.vector-memory.env  (config global, una sola vez)
VECTOR_MEMORY_DATABASE_URL=postgres://vector:vector@localhost:5433/vector_memory
OPENAI_API_KEY=sk-...
```

```bash
# Config MCP para tu agente
vector-memory mcp-config --target claude-code
```

```json
{
  "mcpServers": {
    "vector-memory-pg": {
      "command": "vector-memory",
      "args": ["mcp"],
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "postgres://vector:vector@localhost:5433/vector_memory",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## Herramientas MCP

| Herramienta | Descripción |
|---|---|
| `search_memories` | Búsqueda semántica híbrida con filtros |
| `search_memories_compact` | Igual pero con snippet corto para ahorrar context window |
| `get_memories` | Recupera memorias completas por IDs o public_ids |
| `recent_memories` | Lista memorias recientes |
| `memory_timeline` | Historial cronológico agrupado por fecha |
| `memory_stats` | Estadísticas de la base de conocimiento |
| `save_memory` | Guarda una memoria nueva; acepta `auto_classify: true` |
| `save_session_summary` | Guarda el resumen al final de cada sesión |
| `update_memory` | Corrige o actualiza una memoria existente |
| `deprecate_memory` | Marca una memoria como obsoleta |
| `verify_memory` | Confirma que una memoria sigue siendo válida |
| `reflect_memories` | Detecta contradicciones y gaps; sugiere acciones sin modificar nada |

## Documentación

| Doc | Descripción |
|---|---|
| [Instalación](./docs/installation.md) | Requisitos, Docker, variables de entorno |
| [CLI](./docs/cli.md) | Todos los comandos y flags |
| [HTTP API](./docs/http-api.md) | Endpoints, parámetros, ejemplos |
| [MCP](./docs/mcp.md) | Configuración por agente, herramientas disponibles |
| [Seguridad](./docs/security.md) | Denylist, detector de secretos, dry-run, log |
| [Arquitectura](./docs/architecture.md) | Modelo de datos, ranking, índices, estructura |
| [AGENTS.md](./AGENTS.md) | System prompt de referencia para integrar agentes |
| [Integraciones](./docs/integrations/) | Claude Code, Cursor, Codex, OpenCode, OpenClaw |
| [Conceptos](./docs/concepts/) | Memory banks, reflect, verificación, deprecación |
| [Cookbook](./docs/cookbook/) | Decisiones de arquitectura, bugs, seguridad, sesiones |

## Contribuciones

Bugs, mejoras, documentación e ideas de arquitectura son bienvenidos.
Revisa [CONTRIBUTING.md](./CONTRIBUTING.md) antes de abrir un PR.

## Créditos

Inspirado por el tutorial de
[Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial),
evolucionado hacia una memoria técnica institucional para agentes IA.

Autor: [Carlos Vallejos (cabupy)](https://github.com/cabupy)

## Licencia

MIT. Ver [LICENSE](./LICENSE).
