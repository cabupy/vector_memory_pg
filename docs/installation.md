# Instalacion

## Requisitos

| Dependencia | Version minima |
|---|---|
| Node.js | 22+ |
| PostgreSQL | 16+ |
| pgvector | 0.7+ (compilado para tu version de PG) |
| OpenAI API key | acceso a `text-embedding-3-small` |

PostgreSQL y pgvector deben estar instalados y corriendo antes de ejecutar el setup.

## Instalar pgvector

Si usas Homebrew (macOS):

```bash
brew install pgvector
```

Si compilas desde fuente (necesario para PostgreSQL 17+):

```bash
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

Activar la extension en tu base de datos:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Clonar y configurar

```bash
git clone https://github.com/cabupy/vector_memory_pg.git
cd vector_memory_pg
npm install
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/vector_memory_db
OPENAI_API_KEY=sk-...
```

## Crear el schema

```bash
npm run setup
```

Esto crea (de forma idempotente) las tablas `memories`, `ingest_log` y `sanitization_log`, los indices HNSW y GIN, y la columna `search_vector` generada automaticamente.

## Arrancar los servicios

HTTP API local (puerto 3010 por defecto):

```bash
npm run server
```

MCP server (stdio, para conectar desde tu agente):

```bash
npm run mcp
```

Verificar que todo esta en orden:

```bash
npm run cli doctor
```

## Usar el CLI globalmente

Para tener el comando `vector-memory` disponible en cualquier directorio:

```bash
npm link
```

Verificar:

```bash
vector-memory doctor
```

## Variables de entorno

| Variable | Descripcion | Default |
|---|---|---|
| `DATABASE_URL` | URL de conexion a PostgreSQL | requerida |
| `OPENAI_API_KEY` | API key de OpenAI | requerida |
| `PORT` | Puerto del HTTP API | `3010` |
| `INGEST_SECRET_MODE` | `block` o `redact` al detectar secretos | `block` |
| `MEMORY_ORGANIZATION` | Organizacion por defecto al ingestar | — |
| `MEMORY_PROJECT` | Proyecto por defecto al ingestar | — |
| `MEMORY_REPO_NAME` | Repo por defecto al ingestar | — |
| `MEMORY_TYPE` | Tipo de memoria por defecto al ingestar | source type |
| `MEMORY_CRITICALITY` | Criticidad por defecto al ingestar | `normal` |
| `MEMORY_TAGS` | Tags por defecto al ingestar (coma) | — |
