# vector_memory_pg

Memoria tecnica persistente para agentes IA, construida sobre PostgreSQL, pgvector, OpenAI embeddings, HTTP API y MCP.

El objetivo del proyecto es servir como una memoria institucional y consultable para desarrollo asistido por IA: sesiones, notas, documentos, decisiones tecnicas, reglas por repo y conocimiento historico que un agente pueda recuperar antes de proponer o ejecutar cambios.

Repositorio: [github.com/cabupy/vector_memory_pg](https://github.com/cabupy/vector_memory_pg)

## Caracteristicas

- PostgreSQL + pgvector con embeddings `text-embedding-3-small` de 1536 dimensiones.
- Busqueda hibrida: similitud vectorial + PostgreSQL Full-Text Search.
- Ranking por similitud, coincidencia exacta, estado, criticidad y verificacion reciente.
- Metadata por organizacion, proyecto, repo, tipo de memoria, estado, criticidad y tags.
- HTTP API local para query, recientes, stats e ingesta manual.
- Servidor MCP para agentes compatibles con Model Context Protocol.
- Herramientas MCP de lectura y escritura de memoria.
- Control de vigencia con `status` y `last_verified_at`.
- Denylist basica para evitar indexar paths sensibles como `.env`, llaves privadas y credenciales.

## Casos De Uso

- Recordar decisiones de arquitectura de un repo.
- Consultar reglas de seguridad antes de modificar endpoints.
- Guardar aprendizajes relevantes al terminar una tarea con un agente.
- Separar memoria por empresa, proyecto y repo.
- Deprecar memorias obsoletas sin borrarlas.
- Verificar memorias criticas antes de reutilizarlas.
- Buscar terminos tecnicos exactos como `JWT`, `PostGIS`, `payment-gateway`, `Docker` o `GitHub Actions`.

## Arquitectura

```text
Sesiones JSONL + Markdown + memorias MCP
        |
        v
Chunker / save_memory
        |
        v
OpenAI API -> text-embedding-3-small, 1536 dims
        |
        v
PostgreSQL + pgvector
        |-- vector(1536) + HNSW
        |-- tsvector + GIN
        |-- metadata + vigencia + criticidad
        |
        |-- HTTP API local
        `-- MCP Server stdio
```

## Modelo De Datos

La tabla principal `memories` guarda, entre otros:

```text
id
content
source_type
source_path
session_key
organization
project
repo_name
memory_type
status
criticality
tags
last_verified_at
created_at
metadata
chunk_index
token_count
search_vector
embedding vector(1536)
```

Valores comunes:

```text
status: active, deprecated, superseded, archived
criticality: low, normal, high, critical
memory_type: memory, decision, architecture, security, bug, convention, command, integration, deployment, docs, session
```

## Ranking

La busqueda semantica usa un score hibrido:

```text
70% similitud vectorial
20% full-text rank
boost/penalizacion por status
boost por criticality
boost por last_verified_at reciente
```

Los resultados devuelven:

```text
score
vector_score
text_rank
status_score
criticality_score
verification_score
```

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Extension pgvector instalada
- OpenAI API key con acceso a `text-embedding-3-small`

## Setup

```bash
npm install
cp .env.example .env
npm run setup
```

Editar `.env`:

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/vector_memory_db
OPENAI_API_KEY=tu_openai_api_key_aqui
```

Arrancar HTTP API:

```bash
npm run server
```

Arrancar MCP:

```bash
npm run mcp
```

## HTTP API

### Buscar memorias

```bash
curl "http://localhost:3010/query?q=rate+limit+JWT&limit=5"
```

Filtros soportados:

```text
types=session,daily,memory,docs,brain
organization=ACME
project=demo-project
repo_name=api-service
memory_type=security
status=active
criticality=high
tags=auth,jwt
```

Ejemplo:

```bash
curl "http://localhost:3010/query?q=rate+limit+JWT&repo_name=api-service&memory_type=security&status=active&limit=5"
```

### Memorias recientes

```bash
curl "http://localhost:3010/recent?limit=5&status=active"
```

### Estadisticas

```bash
curl "http://localhost:3010/stats"
```

### Ingesta manual

```bash
curl -X POST http://localhost:3010/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "path": "docs/architecture.md",
    "type": "docs",
    "organization": "ACME",
    "project": "demo-project",
    "repo_name": "api-service",
    "memory_type": "architecture",
    "criticality": "high",
    "tags": ["architecture", "api"]
  }'
```

## MCP

Agregar al archivo MCP de tu agente:

```json
{
  "mcpServers": {
    "vector-memory": {
      "command": "node",
      "args": ["/ruta/a/vector_memory_pg/src/mcp-server.js"],
      "cwd": "/ruta/a/vector_memory_pg"
    }
  }
}
```

Herramientas disponibles:

| Herramienta | Descripcion |
|---|---|
| `search_memories` | Busca memorias por similitud semantica y ranking hibrido |
| `recent_memories` | Lista memorias recientes con filtros |
| `memory_stats` | Devuelve estadisticas basicas |
| `save_memory` | Guarda una memoria manual con embedding y metadata |
| `update_memory` | Actualiza contenido/metadata y recalcula embedding si cambia el contenido |
| `deprecate_memory` | Marca una memoria como `deprecated` sin borrarla |
| `verify_memory` | Actualiza `last_verified_at` y registra auditoria en metadata |

## Seguridad

Antes de indexar, el sistema bloquea paths sensibles conocidos:

```text
.env
.env.*
*.pem
*.key
id_rsa
id_ed25519
credentials.json
service-account.json
secrets/
.secrets/
```

Pendiente para futuras versiones:

```text
detector de secretos por contenido
redaccion automatica
dry-run de ingesta
logs de sanitizacion
```

## Scripts

```bash
npm run setup       # Crea/actualiza schema
npm run server      # HTTP API local
npm run mcp         # MCP server stdio
npm run query       # Cliente/query local
npm run ingest:one  # Ingesta de un archivo
```

## Estructura

```text
src/
  db.js           PostgreSQL + pgvector + queries
  query.js        API interna de busqueda/escritura
  mcp-server.js   Herramientas MCP
  server.js       HTTP API
  ingest-one.js   Ingesta incremental de un archivo
  embeddings.js   OpenAI embeddings via fetch
  chunker.js      Chunking de JSONL y Markdown
  security.js     Denylist de paths sensibles
  setup-db.js     Inicializacion del schema
sql/
  schema.sql      DDL idempotente
```

## Open Source

Este proyecto acepta contribuciones. Bugs, mejoras, documentacion, issues, ideas de arquitectura y PRs son bienvenidos.

Antes de abrir un PR, revisa [CONTRIBUTING.md](./CONTRIBUTING.md).

## Roadmap

El roadmap detallado esta en [mejoras.md](./mejoras.md).

## Creditos

Inspirado por el tutorial de [Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial), evolucionado hacia una memoria tecnica persistente e institucional para agentes IA.

## Licencia

MIT. Ver [LICENSE](./LICENSE).
