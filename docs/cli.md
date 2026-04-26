# CLI — vector-memory

El CLI `vector-memory` permite gestionar la memoria desde la terminal, integrarse con proyectos existentes y buscar sin necesidad de levantar el servidor HTTP.

## Instalacion

```bash
npm install -g vector-memory-pg
```

Verificar:

```bash
vector-memory
```

Para desarrollo local (desde el repo):

```bash
npm link
```

---

## quickstart

Configuración guiada desde cero: detecta el repo git, escribe
`~/.vector-memory.env`, aplica el schema de la DB, muestra la config MCP
y ejecuta `doctor`.

```bash
vector-memory quickstart
```

Crea (o actualiza) `~/.vector-memory.env` con:

```
VECTOR_MEMORY_DATABASE_URL=postgres://...
OPENAI_API_KEY=sk-...
```

Recomendado como primer paso en una instalación nueva.

---

## mcp-config

Genera el snippet de configuración MCP listo para pegar en tu agente.

```bash
vector-memory mcp-config
vector-memory mcp-config --target claude-code
vector-memory mcp-config --target opencode
vector-memory mcp-config --target cursor
```

Targets disponibles: `claude-code` (default), `opencode`, `cursor`, `openclaw`.

Ejemplo de salida (`claude-code`):

```json
{
  "mcpServers": {
    "vector-memory-pg": {
      "command": "vector-memory",
      "args": ["mcp"],
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "postgres://...",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

---

## worker

Levanta el servidor HTTP + MCP en `http://localhost:3010`.

```bash
vector-memory worker
```

Abre la UI web en el browser al iniciar:

```bash
vector-memory worker --open
```

El servidor expone:
- HTTP API en `http://localhost:3010`
- UI web en `http://localhost:3010/ui`
- MCP sobre stdio (via `mcp-config`)

---

## init-project

Crea `.vector-memory.json` en el directorio actual con la configuracion del proyecto. Auto-detecta `repo_name` y `organization` desde el remote de git.

```bash
vector-memory init-project
```

Modo no interactivo (acepta todos los defaults y flags):

```bash
vector-memory init-project --yes \
  --org ACME \
  --project demo-project \
  --repo api-service \
  --type docs \
  --criticality normal \
  --ingest-paths "README.md,docs/"
```

Con ingesta inicial inmediata al terminar:

```bash
vector-memory init-project --yes --ingest
```

### Archivo generado

```json
{
  "organization": "ACME",
  "project": "demo-project",
  "repo_name": "api-service",
  "memory_type": "docs",
  "criticality": "normal",
  "tags": [],
  "ingest_paths": ["README.md", "docs/"]
}
```

Este archivo puede commitearse junto al proyecto para que otros colaboradores usen la misma configuracion.

---

## doctor

Verifica que todo este en orden antes de usar la memoria.

```bash
vector-memory doctor
```

Checks:

- Node.js >= 22
- `VECTOR_MEMORY_DATABASE_URL` o `DATABASE_URL` en entorno
- `OPENAI_API_KEY` en entorno
- `.vector-memory.json` presente (busca hacia arriba en el arbol de directorios)
- Conexion a PostgreSQL
- Extension `pgvector` instalada
- Tabla `memories` accesible (muestra cantidad de registros)

Sale con codigo 1 si algun check falla.

---

## ingest

Ingesta archivos usando la configuracion del proyecto. Expande directorios buscando `.md` y `.jsonl`.

```bash
vector-memory ingest                         # usa ingest_paths del .vector-memory.json
vector-memory ingest docs/guia.md           # archivo especifico
vector-memory ingest docs/                  # directorio (expande .md y .jsonl)
vector-memory ingest README.md docs/        # multiples paths
```

### Flags

| Flag | Descripcion |
|---|---|
| `--dry-run` | Simula sin guardar: muestra chunks y secretos detectados |
| `--secret-mode block` | Bloquea archivos con secretos (default) |
| `--secret-mode redact` | Redacta secretos con `[REDACTED:<tipo>]` antes de guardar |

Ejemplos:

```bash
vector-memory ingest --dry-run
vector-memory ingest --secret-mode redact
vector-memory ingest docs/ --dry-run --secret-mode redact
```

### Comportamiento incremental

La ingesta es incremental: si el archivo no cambio desde la ultima vez (comparando `mtime`), se saltea con `sin cambios`. Solo se re-ingesta si el archivo fue modificado.

---

## search

Busca memorias por similitud semantica con output legible en terminal.

```bash
vector-memory search "rate limit JWT"
vector-memory search "arquitectura microservicios" --limit 10
vector-memory search "docker deploy" --repo api-service --type deployment
vector-memory search "seguridad" --status active --criticality high
```

### Flags

| Flag | Descripcion | Default |
|---|---|---|
| `--limit N` | Numero de resultados | 5 |
| `--repo NAME` | Filtrar por `repo_name` | — |
| `--org ORG` | Filtrar por `organization` | — |
| `--project PROJECT` | Filtrar por `project` | — |
| `--type TYPE` | Filtrar por `memory_type` | — |
| `--status STATUS` | Filtrar por `status` | — |
| `--criticality LEVEL` | Filtrar por `criticality` | — |

---

## init

Crea `.vector-memory.json` en el directorio actual. Sin flags, equivale a `init-project`.
Con `--tools`, configura además las instrucciones de uso y slash commands para el agente.

```bash
vector-memory init                          # igual que init-project
vector-memory init --tools claude-code      # init + skills + commands + mcp-config
vector-memory init --tools opencode,cursor  # múltiples agentes
```

Agentes disponibles: `claude-code`, `cursor`, `codex`, `opencode`, `openclaw`.

---

## skills install

Instala las instrucciones de uso de vector-memory en el archivo de config del agente.

```bash
vector-memory skills install --target claude-code
vector-memory skills install --target opencode
vector-memory skills install --target cursor
```

| Target | Archivo destino |
|---|---|
| `claude-code` | `CLAUDE.md` |
| `opencode` / `codex` / `openclaw` | `AGENTS.md` |
| `cursor` | `.cursor/rules/vector-memory.mdc` |

La operación es idempotente: usa el marker `<!-- vector-memory-skill -->` para evitar duplicados.

---

## commands install

Instala 5 slash commands para invocar flujos de memoria desde el chat del agente.

```bash
vector-memory commands install --target claude-code
vector-memory commands install --target opencode
```

| Target | Directorio destino |
|---|---|
| `claude-code` | `.claude/commands/` |
| `opencode` / `openclaw` | `.opencode/commands/` |

Comandos instalados: `/vm-context`, `/vm-search`, `/vm-save`, `/vm-reflect`, `/vm-iterate`.

---

## bank

Gestiona bancos de memoria: colecciones nombradas asociadas a un proyecto o dominio.

```bash
vector-memory bank ls                     # lista todos los bancos
vector-memory bank create mi-proyecto     # crea un banco
vector-memory bank show mi-proyecto       # estadísticas del banco
```

La configuración de bancos se guarda en `~/.vector-memory-banks.json`.

---

## doc

Lista e ingesta documentos dentro de un banco de memoria.

```bash
vector-memory doc ls mi-proyecto              # lista documentos del banco
vector-memory doc create mi-proyecto README.md  # ingesta un archivo en el banco
```

`doc create` sobreescribe temporalmente `MEMORY_ORGANIZATION` y `MEMORY_PROJECT`
para que las memorias queden asociadas al banco correcto.

---

## manifest

Muestra un resumen compacto de un banco de memoria: stats, tipos, criticidad, tags y memorias verificadas.

```bash
vector-memory manifest mi-proyecto
```

Útil para dar contexto a un agente al inicio de sesión sin saturar el context window.

---

## iterate

Ejecuta `reflect_memories` y presenta los hallazgos en la terminal.
Sugiere qué deprecar, qué consolidar y qué agregar — sin modificar nada.

```bash
vector-memory iterate
vector-memory iterate --limit 30 --project mi-proyecto
```

| Flag | Descripción | Default |
|---|---|---|
| `--limit N` | Máximo de memorias a analizar | 20 |
| `--project PROJECT` | Filtrar por proyecto | — |
| `--repo NAME` | Filtrar por repo | — |
| `--org ORG` | Filtrar por organización | — |

---

## Flujo tipico en un nuevo proyecto

```bash
cd mi-proyecto/
vector-memory init --tools claude-code   # detecta repo/org, instala skills+commands
vector-memory doctor                     # verifica todo
vector-memory ingest                     # ingesta README.md y docs/
vector-memory search "auth"             # busca memorias relevantes
vector-memory worker --open             # levanta server y abre UI en browser
```

---

## Config lookup

El CLI busca `.vector-memory.json` desde el directorio actual hacia arriba (igual que `git` busca `.git`). Esto permite correr `vector-memory search` desde cualquier subdirectorio del proyecto y obtener el contexto correcto.
