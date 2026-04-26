# Arquitectura

## Diagrama general

```text
Sesiones JSONL + Markdown + memorias MCP
        |
        v
Chunker / save_memory
        |
        v
OpenAI API  →  text-embedding-3-small, 1536 dims
        |
        v
PostgreSQL + pgvector
        |-- vector(1536) + HNSW     (busqueda semantica sublineal)
        |-- tsvector + GIN          (full-text search)
        |-- metadata + vigencia + criticidad
        |
        |-- HTTP API local  (puerto 3010)
        |-- MCP Server stdio
        `-- CLI vector-memory
```

---

## Modelo de datos

### Tabla `memories`

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | text | ID unico del chunk |
| `content` | text | Contenido del chunk |
| `source_type` | text | Tipo de fuente (`session`, `docs`, `memory`, etc.) |
| `source_path` | text | Ruta del archivo de origen |
| `session_key` | text | Key de sesion (para JSONL) |
| `organization` | text | Organizacion |
| `project` | text | Proyecto |
| `repo_name` | text | Repositorio |
| `memory_type` | text | Tipo de memoria (ver abajo) |
| `status` | text | Estado de vigencia (ver abajo) |
| `criticality` | text | Criticidad (ver abajo) |
| `tags` | text[] | Lista de tags |
| `last_verified_at` | timestamptz | Ultima verificacion manual |
| `created_at` | timestamptz | Fecha de creacion |
| `metadata` | jsonb | Metadata adicional libre |
| `chunk_index` | int | Indice del chunk dentro del archivo |
| `token_count` | int | Estimacion de tokens |
| `search_vector` | tsvector | Columna generada para FTS |
| `embedding` | vector(1536) | Embedding de OpenAI |

### Valores de `memory_type`

```text
memory       observacion general
decision     decision de arquitectura o tecnica
architecture descripcion de componentes o sistemas
security     regla, politica o hallazgo de seguridad
bug          bug conocido o workaround
convention   convencion de codigo o nomenclatura
command      comando o script util
integration  integracion con sistemas externos
deployment   configuracion de deploy o infra
docs         documentacion tecnica
session      fragmento de sesion de agente
```

### Valores de `status`

```text
active       vigente y confiable
deprecated   obsoleto, no usar
superseded   reemplazado por otra memoria
archived     guardado por historial, no activo
```

### Valores de `criticality`

```text
low          informativo
normal       uso general
high         importante, revisar antes de modificar
critical     nunca ignorar, bloquea cambios sin revision
```

---

## Ranking hibrido

La busqueda semantica calcula un `hybrid_score` combinando:

```text
0.70 * similitud vectorial (coseno via pgvector)
0.20 * ts_rank_cd (full-text search de PostgreSQL)
+ boost por status:      active +0.08 | deprecated -0.25 | superseded -0.35 | archived -0.45
+ boost por criticality: critical +0.12 | high +0.08 | normal +0.03 | low 0
+ boost por verificacion: verificado < 30 dias +0.08 | < 90 dias +0.04 | nunca -0.02
```

Los resultados incluyen los scores parciales para inspeccion:

```json
{
  "score": 0.8412,
  "vector_score": 0.9102,
  "text_rank": 0.3210,
  "status_score": 0.08,
  "criticality_score": 0.08,
  "verification_score": -0.02
}
```

---

## Chunking

Los archivos se dividen en chunks antes de embeber:

- **Markdown** (`*.md`): chunks de ~1500 caracteres con overlap de 200.
- **JSONL** (`*.jsonl`): cada linea es un mensaje; se agrupan en ventanas de contexto de sesion.

El `chunk_index` identifica la posicion del chunk dentro del archivo original.

---

## Indices

```sql
-- Busqueda semantica (HNSW: sublineal, m=16, ef_construction=64)
CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search
CREATE INDEX ON memories USING gin (search_vector);

-- Filtros de metadata
CREATE INDEX ON memories (organization, project, repo_name);
CREATE INDEX ON memories (status, criticality);
CREATE INDEX ON memories (created_at DESC);
```

---

## Estructura de archivos

```text
src/
  cli.js          CLI: init-project, doctor, ingest, search
  db.js           PostgreSQL pool, queries, schema init
  query.js        searchMemories, saveMemory, updateMemory, etc.
  mcp-server.js   Herramientas MCP (lectura y escritura)
  server.js       HTTP API Express
  ingest-one.js   Ingesta incremental de un archivo
  embeddings.js   OpenAI text-embedding-3-small via fetch
  chunker.js      Chunking de JSONL y Markdown
  security.js     Denylist, detector de secretos, redaccion
  setup-db.js     Aplica schema.sql

sql/
  schema.sql      DDL idempotente: memories, ingest_log, sanitization_log

scripts/
  ingest.sh       Ingesta batch incremental configurable

docs/
  architecture.md  Este archivo
  cli.md           Referencia del CLI
  http-api.md      Referencia del HTTP API
  installation.md  Instalacion y configuracion
  mcp.md           Configuracion MCP y herramientas
  security.md      Denylist, detector y modos de secretos
  archive/         Notas historicas de planificación

ROADMAP.md         Roadmap público resumido
```
