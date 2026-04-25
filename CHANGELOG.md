# Changelog

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.9.3] - 2026-04-25

### Cambiado
- README reescrito para reflejar el estado actual: instalación via npm, UI web, `worker --open`, `VECTOR_MEMORY_DATABASE_URL`, `~/.vector-memory.env`, tabla completa de 11 herramientas MCP, session events y content policy

---

## [1.9.2] - 2026-04-25

### Agregado
- `vector-memory worker --open` — abre la UI en el browser automáticamente al iniciar el server (macOS, Linux, Windows)
- El output del worker ahora muestra la URL de la UI explícitamente

---

## [1.9.1] - 2026-04-25

### Corregido / Mejorado
- **Aislamiento de base de datos**: `vector-memory worker` ya no usará la DB de otro proyecto si se corre desde un directorio con su propio `.env`
- Nueva var dedicada `VECTOR_MEMORY_DATABASE_URL` con prioridad sobre `DATABASE_URL` genérico
- Nueva config global de usuario `~/.vector-memory.env` — se carga antes que el `.env` del CWD; setear aquí la URL garantiza que funcione desde cualquier directorio
- Orden de carga en todos los entry points: `shell env` > `~/.vector-memory.env` > `.env del CWD` > `.env del paquete`
- `src/load-env.js` — helper centralizado que exporta `getDatabaseUrl()`
- `mcp-config` genera config con `VECTOR_MEMORY_DATABASE_URL` en lugar de `DATABASE_URL`
- `doctor` reporta `VECTOR_MEMORY_DATABASE_URL` y avisa si está usando `DATABASE_URL` como fallback
- `.env.example` actualizado para promover `VECTOR_MEMORY_DATABASE_URL` como opción principal

### Retrocompatibilidad
- `DATABASE_URL` sigue funcionando como fallback — setups existentes no se rompen

---

## [1.9.0] - 2026-04-25

### Agregado
- `src/ui/` — interfaz web local embebida (dark theme, vanilla JS, sin dependencias frontend):
  - **Search**: búsqueda semántica con filtros de status, tipo y límite; cards con public_id, score, badges de criticidad y estado
  - **Recientes**: últimas N memorias ordenadas por fecha, con botón de actualización
  - **Timeline**: historial agrupado por día con rango de fechas configurable
  - **Stats**: totales, tamaño de DB y distribución visual por tipo de memoria
- `GET /ui` y `GET /ui/*` en `server.js` — sirve archivos estáticos de `src/ui/` con MIME types correctos y protección contra path traversal
- Accesible en `http://localhost:3010/ui` al correr `vector-memory worker`
- Atajo de teclado `/` para enfocar el campo de búsqueda desde cualquier vista

### Cambiado
- `server.js`: importa `extname` de `path`; agrega helper `serveStatic()` y bloque de despacho para rutas `/ui`
- `.npmignore`: comentario explícito para recordar que `src/ui/` debe incluirse en el paquete npm

---

## [1.8.0] - 2026-04-25

### Agregado
- MCP tool `search_memories_compact` — búsqueda semántica con salida reducida (snippet 150 chars) para minimizar uso de context window
- MCP tool `get_memories` — recupera memorias completas por lista de IDs o public_ids (VM-XXXXXX); complemento natural de compact
- MCP tool `memory_timeline` — historial cronológico agrupado por fecha, con filtros de período y metadata
- HTTP `GET /query/compact` — equivalente HTTP de search_memories_compact
- HTTP `GET /memories?ids=id1,id2` — fetch de memorias por IDs
- HTTP `GET /timeline?project=<p>&from=YYYY-MM-DD` — timeline por HTTP
- `AGENTS.md` — system prompt de referencia para agentes que integran vector-memory; incluye flujo de sesión, políticas de contenido, filtros disponibles y ejemplos

### Cambiado
- `db.js`: funciones `getMemoriesByIds()` y `getTimeline()` (con agrupación por día en DB)
- `query.js`: exporta `getMemories()`, `searchMemoriesCompact()`, `memoryTimeline()`

---

## [1.7.0] - 2026-04-25

### Agregado
- `src/content-policy.js` — políticas de contenido: `@no-memory` omite la memoria, `<private>...</private>` redacta bloques privados antes de guardar
- HTTP endpoints de eventos de sesión:
  - `POST /events/session-start` — inicia sesión, inyecta contexto de memorias relevantes si `contextInjection.enabled` en `.vector-memory.json`
  - `POST /events/post-tool-use` — guarda observaciones de tool-use con `auto_save` configurable
  - `POST /events/session-end` — guarda resumen de sesión y cierra la sesión activa
  - `GET /events/sessions` — lista sesiones activas (monitoring)
- `saveSessionSummary()` en `query.js` — función reutilizable por HTTP API y MCP
- MCP tool `save_session_summary` — el agente llama esta herramienta al final de cada sesión para persistir el resumen
- `applyContentPolicy()` aplicado en `save_memory` y `save_session_summary` MCP: respeta `@no-memory` y `<private>`
- CLI `vector-memory worker [--port PORT] [--host HOST]` — inicia el HTTP server en modo daemon, documentado para uso desde agentes
- `.vector-memory.json` extendido con bloque `contextInjection: { enabled, limit }` — configura inyección de contexto en session-start

### Cambiado
- `server.js` refactorizado: helpers `readBody()` y `loadProjectConfig()`, sesiones activas en Map en memoria

---

## [1.6.0] - 2026-04-25

### Agregado
- `docker-compose.yml` con PostgreSQL 17 + pgvector (`pgvector/pgvector:pg17`), healthcheck, schema auto-init y servicio `api` en profile `full`
- `Dockerfile` para el servicio HTTP API (Node.js 18 Alpine)
- `.dockerignore` para imagen limpia
- CLI `vector-memory quickstart` — configuración guiada desde cero: crea `.env`, aplica migraciones, detecta repo git, muestra config MCP, ejecuta doctor
- CLI `vector-memory migrate` — aplica `schema.sql` contra la DB configurada
- CLI `vector-memory mcp-config [--target]` — genera snippet de config MCP para claude-code, opencode, cursor, openclaw
- CLI `vector-memory up / down` — wrappers de `docker compose up/down`
- Scripts npm `up`, `down`, `up:full` en `package.json`
- `.env.example` actualizado con DATABASE_URL de Docker y variables opcionales de Compose

### Cambiado
- `public_id` (`VM-000001`) agregado al schema con secuencia PostgreSQL, backfill idempotente e índice único
- `search` CLI ahora muestra `public_id` al inicio de cada resultado
- `init-project` auto-detecta `AGENTS.md`, `README.md` y `docs/` como candidatos de ingesta

---

## [1.5.0] - 2026-04-24

### Agregado
- CLI `vector-memory` (`src/cli.js`) con cuatro comandos:
  - `init-project` — crea `.vector-memory.json`, auto-detecta `repo_name`/`org` del git remote, flag `--yes` no-interactivo, flag `--ingest` para ingesta inmediata
  - `doctor` — verifica Node 18+, `DATABASE_URL`, `OPENAI_API_KEY`, config file, conexión PG, extensión pgvector y tabla `memories`
  - `ingest` — expande directorios, propaga config al entorno, soporta `--dry-run` y `--secret-mode`, spawn de `ingest-one.js`
  - `search` — búsqueda semántica con output legible, flags `--limit`, `--repo`, `--type`, `--status`, `--org`, `--project`
- `package.json`: entrada `bin` → `vector-memory`, script `npm run cli`
- Supresión de `ExperimentalWarning` (Fetch API) en Node 18
- README refactorizado como hub (400 → 89 líneas): tagline, barra de navegación, Quick Start, tabla de docs
- 6 documentos en `docs/`: `installation.md`, `cli.md`, `http-api.md`, `mcp.md`, `security.md`, `architecture.md`
- Banner `assets/images/banner.png` (1280×640) en README
- `.npmignore` para excluir `assets/`, `docs/`, `scripts/` del paquete npm
- `.vector-memory.json` agregado a `.gitignore`

---

## [1.4.0] - 2026-04-24

### Agregado
- `redactSecrets(content)` en `src/security.js` — reemplaza secretos detectados con `[REDACTED:<type>]`
- `applySecretPolicy(content, filePath, mode)` — abstracción para modo `block` (default) o `redact` (via `INGEST_SECRET_MODE`)
- Flag `--dry-run` en `ingest-one.js` — simula ingesta completa (chunking, detección de secretos, preview de chunks) sin guardar en DB
- Soporte `dry_run: true` y `secret_mode` en `POST /ingest` de la HTTP API
- Tabla `sanitization_log` en PostgreSQL — registra eventos de bloqueo y redacción con `file_path`, `action`, `reason`, `findings`
- Endpoint `GET /sanitization-log` — consulta el historial de eventos de sanitización
- Funciones `insertSanitizationLog` y `getSanitizationLog` en `src/db.js`

### Corregido
- Scores numéricos (`status_score`, `criticality_score`, etc.) devueltos por `pg` como strings — ahora se parsean con `parseFloat` antes de `toFixed`
- `applySecretPolicy` en modo `redact` retornaba `{ redacted, findings }` en lugar de `{ content, findings }`

---

## [1.3.0] - 2026-04-20

### Agregado
- Herramientas MCP de escritura: `save_memory`, `update_memory`, `deprecate_memory`, `verify_memory`
- `update_memory` recalcula embedding y `token_count` si cambia el contenido
- `deprecate_memory` guarda auditoría en `metadata.deprecated`
- `verify_memory` actualiza `last_verified_at` y guarda auditoría en `metadata.verified`
- Detector de secretos en `src/security.js`: bloquea contenido con `private_key`, `openai_api_key`, `google_api_key`, `aws_access_key`, `jwt`, `postgres_url`, `mongodb_url`, `generic_secret`
- Denylist de paths en `src/security.js`: bloquea `.env*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `credentials.json`, `service-account.json`, directorios `secrets/`

---

## [1.2.0] - 2026-04-15

### Agregado
- Búsqueda híbrida: `70%` similitud vectorial + `20%` full-text (`ts_rank_cd`) + boosts por metadata
- Columna `search_vector TSVECTOR GENERATED ALWAYS` con índice GIN para full-text search
- Ranking por `status_score`, `criticality_score` y `verification_score`
- Resultados de búsqueda incluyen `score`, `vector_score`, `text_rank`, `status_score`, `criticality_score`, `verification_score`
- Filtros en HTTP API y MCP por `organization`, `project`, `repo_name`, `memory_type`, `status`, `criticality`, `tags`

---

## [1.1.0] - 2026-04-10

### Agregado
- Campos de namespace: `organization`, `project`, `repo_name` con índice compuesto
- Campo `memory_type` (architecture, security, bug, decision, convention, command, domain, etc.)
- Campo `status` (`active`, `deprecated`, `superseded`, `archived`) con índice
- Campo `criticality` (`critical`, `high`, `normal`, `low`) con índice
- Campo `tags TEXT[]` con índice GIN
- Campo `last_verified_at TIMESTAMPTZ` con índice
- Migración idempotente con `ALTER TABLE ADD COLUMN IF NOT EXISTS` para instalaciones existentes
- Conectar metadata de namespace, tipo, status, criticidad y tags en ingesta, HTTP API y MCP

---

## [1.0.0] - 2026-03-31

### Agregado
- Servidor MCP (`mcp-server.js`) con herramientas `search_memories`, `recent_memories`, `memory_stats`
- Soporte para tipos de memoria: `session`, `daily`, `memory`, `docs`
- Ingesta incremental por `mtime` via `ingest.sh` + `ingest-one.js`
- HTTP API en puerto 3010: `/query`, `/recent`, `/stats`, `/ingest`

### Cambiado
- Motor de embeddings: Gemini `gemini-embedding-001` (768 dims) → OpenAI `text-embedding-3-small` (1536 dims)
- Base de datos: SQLite + fuerza bruta JS → PostgreSQL + pgvector con índice HNSW

### Base
- Adaptado del tutorial de [Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial)
