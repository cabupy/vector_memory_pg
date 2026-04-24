# Changelog

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

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
