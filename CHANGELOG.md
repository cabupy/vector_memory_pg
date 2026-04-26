# Changelog

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.10.6] - 2026-04-26

### Documentación

- README en español agrega enlace visible a `README.en.md`
- README en inglés agrega enlace visible de vuelta a `README.md`

---

## [1.10.5] - 2026-04-26

### Corregido

- `vector-memory mcp`: el subcomando ahora existe y arranca el servidor MCP por
  stdio; antes `mcp-config` generaba `args: ["mcp"]` pero el router del CLI caía
  en ayuda con `Comando desconocido: mcp`

### Documentación

- README/README.en actualizados con flujo Docker-first usando `vector-memory up`
- `docs/mcp.md` y `docs/cli.md` documentan el subcomando `mcp`
- `docs/integrations.md` ahora lista `reflect_memories` dentro de las 12 herramientas

---

## [1.10.4] - 2026-04-26

### Corregido

- `mcp-config`: ahora omite `VECTOR_MEMORY_DATABASE_URL` y `OPENAI_API_KEY` reales
  por defecto; `--show-secrets` permite imprimirlos explícitamente cuando sea necesario
- `iterate`: `--org` y `--repo` ahora se pasan correctamente a `reflectMemories`
  como `organization` y `repo_name`
- `commands install --target all`: `opencode` y `openclaw` comparten `.opencode/commands`;
  ahora se deduplican para evitar instalación repetida
- `skills install`: los targets se validan antes de deduplicar archivos compartidos,
  evitando que un target inválido tape targets válidos en la misma lista
- `manifest`: elimina queries concurrentes sobre el mismo `pg.Client` para evitar
  warnings de `pg` y futura incompatibilidad con `pg@9`
- `bank show` y `manifest`: contadores vacíos ahora muestran `0` en lugar de `null`
- `parseBankName`: trimea componentes y rechaza componentes vacíos
- `iterate --limit`: valida enteros positivos y muestra error claro

### Documentación

- README y docs de MCP/integraciones actualizados para documentar placeholders seguros
  y `--show-secrets`

---

## [1.10.3] - 2026-04-26

### Corregido

- `skills install --target all`: al agrupar targets que comparten `AGENTS.md`
  (opencode/codex/openclaw), `installSkillForTarget` volvía a imprimir `→ opencode`
  después del header agrupado — línea redundante suprimida con el flag `skipHeader`
- `mcp-config`: `codex` no estaba en el mapa de hints; `mcp-config --target codex`
  ahora indica `AGENTS.md o variable de entorno MCP_SERVERS del entorno Codex`

---

## [1.10.2] - 2026-04-26

### Corregido

- `parseBankName`: nombres con barra inicial (`/proyecto`), barra final (`proyecto/`)
  o más de dos niveles (`org/sub/proyecto`) ahora lanzan error descriptivo en lugar
  de producir queries con datos malformados
- `mcp-config` default: el target por defecto era `'generic'` en código pero `claude-code`
  en la documentación; alineado a `claude-code`
- `cmdInitWithTools` (`init --tools`): ahora verifica si el schema de DB está aplicado
  y muestra un aviso accionable si la tabla `memories` no existe o si la DB no es alcanzable
- `skills install --target all`: `opencode`, `codex` y `openclaw` comparten `AGENTS.md`;
  ahora se deduplican y se instala una sola vez mostrando los targets cubiertos
  (ej: `→ opencode + codex + openclaw (comparten AGENTS.md)`)
- `showBankStats`: el header ahora es configurable via parámetro; permite reutilizar
  la función con contexto correcto desde cualquier comando

---

## [1.10.1] - 2026-04-26

### Corregido

- **Bug crítico**: `bank ls/create/show` siempre caían en el bloque de ayuda —
  `main()` pasaba `{positional, flags}` a `cmdBank` que espera `{subcommand, args, flags}`
- **Bug crítico**: `doc ls/create` mismo problema — `main()` no extraía `subcommand`/`args`
- **Bug crítico**: `manifest <banco>` siempre terminaba con `process.exit(1)` —
  `main()` pasaba `{positional, flags}` a `cmdManifest` que espera `{bankName, flags}`
- **Bug crítico**: `doc create <banco> <file>` ignoraba el banco especificado si había
  `.vector-memory.json` en el directorio — `cmdIngest` pisaba `MEMORY_ORGANIZATION/PROJECT`
  con los valores del config; ahora `cmdIngest` aplica overrides de banco después del config
- `openclaw` estaba ausente de `allTargets` en `cmdCommandsInstall` — era silenciosamente
  ignorado aunque está documentado como target soportado
- `vector-memory skills foo` ejecutaba la instalación sin validar el subcomando;
  ahora solo `install` es aceptado (sin subcomando también funciona por retrocompatibilidad)
- Mismo fix para `vector-memory commands <subcomando>`
- `cmdIterate`: `--org` explícito podía ser pisado por el `.vector-memory.json`;
  ahora los flags explícitos tienen prioridad y el config solo rellena lo que falta
- `--tools` sin valor producía `String(true) = "true"` como target;
  ahora da error claro con ejemplo de uso
- `rl.close()` en `cmdSkillsInstall` y `cmdCommandsInstall` movido a bloque `finally`
  para garantizar cierre de stdin ante errores de I/O
- `printHelp`: eliminado el flag `--target` duplicado

---

## [1.10.0] - 2026-04-26

### Agregado

- **Onboarding multi-agente**: `vector-memory init --tools <tool>` configura
  instrucciones, slash commands y MCP en un solo paso para
  `claude-code`, `cursor`, `codex`, `opencode` y `openclaw`
- **`skills install`**: instala instrucciones de uso en el archivo de config
  del agente (`CLAUDE.md`, `AGENTS.md` o `.cursor/rules/vector-memory.mdc`);
  marker `<!-- vector-memory-skill -->` garantiza idempotencia
- **`commands install`**: instala 5 slash commands en `.claude/commands/`
  o `.opencode/commands/`; comandos: `/vm-context`, `/vm-search`, `/vm-save`,
  `/vm-reflect`, `/vm-iterate`
- **`bank` subcomandos**: `bank ls`, `bank create <nombre>`, `bank show <nombre>`
  para gestionar colecciones nombradas de memorias
- **`doc` subcomandos**: `doc ls <banco>`, `doc create <banco> <file>`
  para listar e ingestar documentos en un banco específico
- **`manifest <banco>`**: resumen compacto del banco con 5 queries paralelas
  (stats, tipos, criticidad, tags, verificadas) para dar contexto a un agente
  sin saturar el context window
- **`iterate`**: ejecuta `reflectMemories` y presenta hallazgos + sugerencias
  en terminal sin modificar nada
- `docs/integrations/`: guías detalladas por agente
  (claude-code.md, cursor.md, codex.md, opencode.md, openclaw.md)
- `docs/concepts/`: memory-banks.md, reflect.md, verification.md, deprecation.md
- `docs/cookbook/`: architecture-decisions.md, known-bugs.md,
  security-rules.md, session-summary.md
- `docs/desktop-roadmap.md`: ideas candidatas para futura app desktop
- `README.en.md`: versión en inglés del README principal
- `README.md`: sección **Bring Your Own Coding Agent** con tabla multi-agente
  y tabla de documentación ampliada

### Mejorado

- `printHelp` actualizado con todos los nuevos comandos y flags
- Router `main()` separado: `init` sin `--tools` llama `cmdInitProject`;
  con `--tools` llama `cmdInitWithTools`

---

## [1.9.9] - 2026-04-25

### Mejorado

- `README.md` reformateado con saltos de línea reales en prosa y listas;
  nueva sección **Ciclo completo** que documenta el flujo end-to-end:
  guardar → buscar → timeline → reflexionar → deprecar → concluir
- `README.md`: Reflect promovido a sección propia dentro de Características,
  con énfasis en que solo sugiere y nunca modifica
- `README.md`: tagline actualizado a "Memoria técnica institucional"
- `CHANGELOG.md` reformateado con saltos de línea consistentes
- `package.json`: description actualizada a
  "Institutional technical memory for AI coding agents using PostgreSQL,
  pgvector, hybrid search, MCP, Reflect, CLI, and local UI";
  keyword `reflect` agregada
- `docs/cli.md`: comandos `quickstart` y `mcp-config` documentados
  (faltaban desde v1.6.0/v1.9.5)

---

## [1.9.8] - 2026-04-25

### Agregado

- HTTP API: `POST /memories` — guarda una memoria directamente sin pasar
  por ingesta de archivo; acepta `auto_classify`
- HTTP API: `POST /memories/:id/deprecate` — depreca una memoria por ID
  o public_id con razón y autor
- UI Reflect: botón **Deprecar** en deprecaciones sugeridas y en hallazgos
  con `suggested_action: "deprecate"` — llama al nuevo endpoint y actualiza
  el botón en pantalla
- UI Reflect: botón **Guardar memoria** en memorias sugeridas — guarda
  directamente con el tipo, criticidad y tags sugeridos por la IA

---

## [1.9.7] - 2026-04-25

### Corregido

- UI Reflect: la vista mostraba `[object Object]` porque el parser asumía
  arrays de strings; ahora renderiza correctamente la estructura real de
  `reflectMemories`:
  - `findings[]` → `{ type, description, memory_ids, suggested_action }` —
    muestra badge de tipo, descripción, IDs clicables y acción sugerida
  - `suggested_new_memories[]` → `{ content, memory_type, criticality, tags }` —
    muestra metadata y tags
  - `suggested_deprecations[]` → array de IDs (strings) o `{ id, reason }` —
    soporta ambos formatos
  - `analyzed_count` (nombre real del campo) en lugar de `memories_analyzed`
  - `summary` del análisis mostrado debajo del conteo

---

## [1.9.6] - 2026-04-25

### Agregado

- UI: nueva vista **Reflect** — formulario con filtros (project, repo_name,
  focus, limit), llama `POST /reflect` y muestra hallazgos, memorias sugeridas
  y deprecaciones sugeridas con color-coding; solo sugiere, no modifica nada
- UI: badge **auto** (amarillo) en los cards de memorias clasificadas
  automáticamente por IA; muestra el porcentaje de confianza en el tooltip

### Actualizado

- `docs/mcp.md` — tabla de herramientas actualizada a 12; `save_memory`
  documenta `auto_classify: true`; sección nueva de `reflect_memories`
  con respuesta de ejemplo; ejemplos de uso actualizados
- `docs/http-api.md` — secciones nuevas: `GET /query/compact`,
  `GET /memories`, `GET /timeline`, `POST /reflect`;
  `POST /ingest` documenta `auto_classify`
- `README.md` — tabla MCP actualizada a 12 herramientas con `reflect_memories`;
  sección de características menciona `auto_classify` y `reflect_memories`
- `AGENTS.md` — tabla de herramientas incluye `reflect_memories`;
  flujo de sesión menciona `auto_classify: true` y `reflect_memories`
  al final de sesión
- `doctor`: avisa explícitamente que sin `OPENAI_API_KEY` no funcionan
  ingesta, `auto_classify` ni `reflect_memories`

---

## [1.9.5] - 2026-04-25

### Agregado

- `src/classify.js` — `classifyMemory(content)`: clasifica automáticamente
  una memoria con gpt-4o-mini; retorna `memory_type`, `criticality`, `tags`
  y `confidence`; no sobreescribe campos provistos explícitamente
- `save_memory` (MCP + HTTP) acepta nuevo parámetro `auto_classify: true`;
  cuando está activo, los campos omitidos (`memory_type`, `criticality`, `tags`)
  se infieren por IA y se guarda `classification_source: 'auto'` en metadata
- `reflect_memories` — nueva herramienta MCP y endpoint `POST /reflect`:
  analiza un conjunto de memorias recientes con gpt-4o-mini y devuelve
  `findings` (contradicciones, duplicados, gaps), `suggested_new_memories`
  y `suggested_deprecations`; solo sugiere, no modifica nada
- `vector-memory quickstart` mejorado: escribe `~/.vector-memory.env`
  (config global) en lugar del `.env` local; muestra instrucciones de
  `worker --open` y las nuevas funciones `auto_classify` / `reflect_memories`

---

## [1.9.4] - 2026-04-25

### Agregado

- `docs/quickstart.md` — guía "primer uso en 5 minutos" con opción
  PostgreSQL local y Docker
- `docs/integrations.md` — ejemplos de integración MCP para Claude Code,
  OpenCode y Cursor
- `docs/client-js.md` — cliente HTTP para JS/TS con fetch nativo y clase TypeScript
- `docs/client-python.md` — cliente HTTP para Python con httpx/requests,
  versión sync y async
- `docs/http-api.md` — sección `GET /ui` con las 4 vistas documentadas;
  sección de session events
- `docs/cli.md` — comando `worker --open`, instalación vía npm,
  Node 22, `VECTOR_MEMORY_DATABASE_URL`
- `AGENTS.md` — sección de reglas de release
  (checklist: push, tag, GitHub release, npm publish)

---

## [1.9.3] - 2026-04-25

### Cambiado

- README reescrito para reflejar el estado actual: instalación via npm,
  UI web, `worker --open`, `VECTOR_MEMORY_DATABASE_URL`,
  `~/.vector-memory.env`, tabla completa de 11 herramientas MCP,
  session events y content policy

---

## [1.9.2] - 2026-04-25

### Agregado

- `vector-memory worker --open` — abre la UI en el browser automáticamente
  al iniciar el server (macOS, Linux, Windows)
- El output del worker ahora muestra la URL de la UI explícitamente

---

## [1.9.1] - 2026-04-25

### Corregido / Mejorado

- **Aislamiento de base de datos**: `vector-memory worker` ya no usará la DB
  de otro proyecto si se corre desde un directorio con su propio `.env`
- Nueva var dedicada `VECTOR_MEMORY_DATABASE_URL` con prioridad sobre
  `DATABASE_URL` genérico
- Nueva config global de usuario `~/.vector-memory.env` — se carga antes
  que el `.env` del CWD; setear aquí la URL garantiza que funcione desde
  cualquier directorio
- Orden de carga en todos los entry points:
  `shell env` > `~/.vector-memory.env` > `.env del CWD` > `.env del paquete`
- `src/load-env.js` — helper centralizado que exporta `getDatabaseUrl()`
- `mcp-config` genera config con `VECTOR_MEMORY_DATABASE_URL` en lugar de
  `DATABASE_URL`
- `doctor` reporta `VECTOR_MEMORY_DATABASE_URL` y avisa si está usando
  `DATABASE_URL` como fallback
- `.env.example` actualizado para promover `VECTOR_MEMORY_DATABASE_URL`
  como opción principal

### Retrocompatibilidad

- `DATABASE_URL` sigue funcionando como fallback — setups existentes no
  se rompen

---

## [1.9.0] - 2026-04-25

### Agregado

- `src/ui/` — interfaz web local embebida (dark theme, vanilla JS,
  sin dependencias frontend):
  - **Search**: búsqueda semántica con filtros de status, tipo y límite;
    cards con public_id, score, badges de criticidad y estado
  - **Recientes**: últimas N memorias ordenadas por fecha,
    con botón de actualización
  - **Timeline**: historial agrupado por día con rango de fechas configurable
  - **Stats**: totales, tamaño de DB y distribución visual por tipo de memoria
- `GET /ui` y `GET /ui/*` en `server.js` — sirve archivos estáticos de
  `src/ui/` con MIME types correctos y protección contra path traversal
- Accesible en `http://localhost:3010/ui` al correr `vector-memory worker`
- Atajo de teclado `/` para enfocar el campo de búsqueda desde cualquier vista

### Cambiado

- `server.js`: importa `extname` de `path`; agrega helper `serveStatic()`
  y bloque de despacho para rutas `/ui`
- `.npmignore`: comentario explícito para recordar que `src/ui/` debe
  incluirse en el paquete npm

---

## [1.8.0] - 2026-04-25

### Agregado

- MCP tool `search_memories_compact` — búsqueda semántica con salida reducida
  (snippet 150 chars) para minimizar uso de context window
- MCP tool `get_memories` — recupera memorias completas por lista de IDs o
  public_ids (VM-XXXXXX); complemento natural de compact
- MCP tool `memory_timeline` — historial cronológico agrupado por fecha,
  con filtros de período y metadata
- HTTP `GET /query/compact` — equivalente HTTP de search_memories_compact
- HTTP `GET /memories?ids=id1,id2` — fetch de memorias por IDs
- HTTP `GET /timeline?project=<p>&from=YYYY-MM-DD` — timeline por HTTP
- `AGENTS.md` — system prompt de referencia para agentes que integran
  vector-memory; incluye flujo de sesión, políticas de contenido,
  filtros disponibles y ejemplos

### Cambiado

- `db.js`: funciones `getMemoriesByIds()` y `getTimeline()`
  (con agrupación por día en DB)
- `query.js`: exporta `getMemories()`, `searchMemoriesCompact()`,
  `memoryTimeline()`

---

## [1.7.0] - 2026-04-25

### Agregado

- `src/content-policy.js` — políticas de contenido: `@no-memory` omite la
  memoria, `<private>...</private>` redacta bloques privados antes de guardar
- HTTP endpoints de eventos de sesión:
  - `POST /events/session-start` — inicia sesión, inyecta contexto de memorias
    relevantes si `contextInjection.enabled` en `.vector-memory.json`
  - `POST /events/post-tool-use` — guarda observaciones de tool-use
    con `auto_save` configurable
  - `POST /events/session-end` — guarda resumen de sesión y cierra la
    sesión activa
  - `GET /events/sessions` — lista sesiones activas (monitoring)
- `saveSessionSummary()` en `query.js` — función reutilizable por
  HTTP API y MCP
- MCP tool `save_session_summary` — el agente llama esta herramienta al
  final de cada sesión para persistir el resumen
- `applyContentPolicy()` aplicado en `save_memory` y `save_session_summary`
  MCP: respeta `@no-memory` y `<private>`
- CLI `vector-memory worker [--port PORT] [--host HOST]` — inicia el HTTP
  server en modo daemon, documentado para uso desde agentes
- `.vector-memory.json` extendido con bloque
  `contextInjection: { enabled, limit }` — configura inyección de contexto
  en session-start

### Cambiado

- `server.js` refactorizado: helpers `readBody()` y `loadProjectConfig()`,
  sesiones activas en Map en memoria

---

## [1.6.0] - 2026-04-25

### Agregado

- `docker-compose.yml` con PostgreSQL 17 + pgvector (`pgvector/pgvector:pg17`),
  healthcheck, schema auto-init y servicio `api` en profile `full`
- `Dockerfile` para el servicio HTTP API (Node.js 18 Alpine)
- `.dockerignore` para imagen limpia
- CLI `vector-memory quickstart` — configuración guiada desde cero: crea
  `.env`, aplica migraciones, detecta repo git, muestra config MCP, ejecuta
  doctor
- CLI `vector-memory migrate` — aplica `schema.sql` contra la DB configurada
- CLI `vector-memory mcp-config [--target]` — genera snippet de config MCP
  para claude-code, opencode, cursor, openclaw
- CLI `vector-memory up / down` — wrappers de `docker compose up/down`
- Scripts npm `up`, `down`, `up:full` en `package.json`
- `.env.example` actualizado con DATABASE_URL de Docker y variables
  opcionales de Compose

### Cambiado

- `public_id` (`VM-000001`) agregado al schema con secuencia PostgreSQL,
  backfill idempotente e índice único
- `search` CLI ahora muestra `public_id` al inicio de cada resultado
- `init-project` auto-detecta `AGENTS.md`, `README.md` y `docs/` como
  candidatos de ingesta

---

## [1.5.0] - 2026-04-24

### Agregado

- CLI `vector-memory` (`src/cli.js`) con cuatro comandos:
  - `init-project` — crea `.vector-memory.json`, auto-detecta
    `repo_name`/`org` del git remote, flag `--yes` no-interactivo,
    flag `--ingest` para ingesta inmediata
  - `doctor` — verifica Node 18+, `DATABASE_URL`, `OPENAI_API_KEY`,
    config file, conexión PG, extensión pgvector y tabla `memories`
  - `ingest` — expande directorios, propaga config al entorno,
    soporta `--dry-run` y `--secret-mode`, spawn de `ingest-one.js`
  - `search` — búsqueda semántica con output legible, flags `--limit`,
    `--repo`, `--type`, `--status`, `--org`, `--project`
- `package.json`: entrada `bin` → `vector-memory`, script `npm run cli`
- Supresión de `ExperimentalWarning` (Fetch API) en Node 18
- README refactorizado como hub (400 → 89 líneas): tagline, barra de
  navegación, Quick Start, tabla de docs
- 6 documentos en `docs/`: `installation.md`, `cli.md`, `http-api.md`,
  `mcp.md`, `security.md`, `architecture.md`
- Banner `assets/images/banner.png` (1280×640) en README
- `.npmignore` para excluir `assets/`, `docs/`, `scripts/` del paquete npm
- `.vector-memory.json` agregado a `.gitignore`

---

## [1.4.0] - 2026-04-24

### Agregado

- `redactSecrets(content)` en `src/security.js` — reemplaza secretos
  detectados con `[REDACTED:<type>]`
- `applySecretPolicy(content, filePath, mode)` — abstracción para modo
  `block` (default) o `redact` (via `INGEST_SECRET_MODE`)
- Flag `--dry-run` en `ingest-one.js` — simula ingesta completa (chunking,
  detección de secretos, preview de chunks) sin guardar en DB
- Soporte `dry_run: true` y `secret_mode` en `POST /ingest` de la HTTP API
- Tabla `sanitization_log` en PostgreSQL — registra eventos de bloqueo y
  redacción con `file_path`, `action`, `reason`, `findings`
- Endpoint `GET /sanitization-log` — consulta el historial de eventos de
  sanitización
- Funciones `insertSanitizationLog` y `getSanitizationLog` en `src/db.js`

### Corregido

- Scores numéricos (`status_score`, `criticality_score`, etc.) devueltos
  por `pg` como strings — ahora se parsean con `parseFloat` antes de `toFixed`
- `applySecretPolicy` en modo `redact` retornaba `{ redacted, findings }`
  en lugar de `{ content, findings }`

---

## [1.3.0] - 2026-04-20

### Agregado

- Herramientas MCP de escritura:
  `save_memory`, `update_memory`, `deprecate_memory`, `verify_memory`
- `update_memory` recalcula embedding y `token_count` si cambia el contenido
- `deprecate_memory` guarda auditoría en `metadata.deprecated`
- `verify_memory` actualiza `last_verified_at` y guarda auditoría en
  `metadata.verified`
- Detector de secretos en `src/security.js`: bloquea contenido con
  `private_key`, `openai_api_key`, `google_api_key`, `aws_access_key`,
  `jwt`, `postgres_url`, `mongodb_url`, `generic_secret`
- Denylist de paths en `src/security.js`: bloquea `.env*`, `*.pem`,
  `*.key`, `id_rsa`, `id_ed25519`, `credentials.json`,
  `service-account.json`, directorios `secrets/`

---

## [1.2.0] - 2026-04-15

### Agregado

- Búsqueda híbrida: `70%` similitud vectorial + `20%` full-text
  (`ts_rank_cd`) + boosts por metadata
- Columna `search_vector TSVECTOR GENERATED ALWAYS` con índice GIN
  para full-text search
- Ranking por `status_score`, `criticality_score` y `verification_score`
- Resultados de búsqueda incluyen `score`, `vector_score`, `text_rank`,
  `status_score`, `criticality_score`, `verification_score`
- Filtros en HTTP API y MCP por `organization`, `project`, `repo_name`,
  `memory_type`, `status`, `criticality`, `tags`

---

## [1.1.0] - 2026-04-10

### Agregado

- Campos de namespace: `organization`, `project`, `repo_name`
  con índice compuesto
- Campo `memory_type` (architecture, security, bug, decision, convention,
  command, domain, etc.)
- Campo `status` (`active`, `deprecated`, `superseded`, `archived`)
  con índice
- Campo `criticality` (`critical`, `high`, `normal`, `low`) con índice
- Campo `tags TEXT[]` con índice GIN
- Campo `last_verified_at TIMESTAMPTZ` con índice
- Migración idempotente con `ALTER TABLE ADD COLUMN IF NOT EXISTS`
  para instalaciones existentes
- Conectar metadata de namespace, tipo, status, criticidad y tags en
  ingesta, HTTP API y MCP

---

## [1.0.0] - 2026-03-31

### Agregado

- Servidor MCP (`mcp-server.js`) con herramientas
  `search_memories`, `recent_memories`, `memory_stats`
- Soporte para tipos de memoria: `session`, `daily`, `memory`, `docs`
- Ingesta incremental por `mtime` via `ingest.sh` + `ingest-one.js`
- HTTP API en puerto 3010: `/query`, `/recent`, `/stats`, `/ingest`

### Cambiado

- Motor de embeddings: Gemini `gemini-embedding-001` (768 dims) →
  OpenAI `text-embedding-3-small` (1536 dims)
- Base de datos: SQLite + fuerza bruta JS →
  PostgreSQL + pgvector con índice HNSW

### Base

- Adaptado del tutorial de
  [Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial)
