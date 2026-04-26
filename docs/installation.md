# Instalacion

La forma recomendada de instalar `vector-memory` es usar **Node.js local +
PostgreSQL/pgvector en Docker Compose**. Es el flujo mas portable entre macOS,
Linux y WSL2, y evita instalar `pgvector` manualmente en cada sistema.

---

## Requisitos

| Dependencia | Uso | Version minima |
|---|---|---|
| Node.js | CLI, servidor MCP, worker HTTP/UI | 22+ |
| Docker + Compose | PostgreSQL + pgvector portable | Docker con `docker compose` |
| OpenAI API key | embeddings `text-embedding-3-small` | requerida |

PostgreSQL nativo es opcional. Si usas Docker, la imagen
`pgvector/pgvector:pg17` ya trae PostgreSQL y pgvector listos.

---

## Opcion recomendada — Docker Compose

### 1. Instalar el CLI

```bash
npm install -g vector-memory-pg
```

Verifica que el binario este disponible:

```bash
vector-memory
```

### 2. Configurar variables globales

Crea `~/.vector-memory.env`:

```env
VECTOR_MEMORY_DATABASE_URL=postgres://vector:vector@localhost:5433/vector_memory
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

`~/.vector-memory.env` es preferido para uso diario porque se carga desde
cualquier directorio y no colisiona con los `.env` de tus proyectos.

### 3. Levantar PostgreSQL + pgvector

Desde cualquier directorio:

```bash
vector-memory up
```

Esto usa el `docker-compose.yml` incluido en el paquete y levanta solo
PostgreSQL en `localhost:5433`.

Si 5433 ya esta ocupado, usa un `.env` en el directorio desde donde ejecutas el
comando:

```env
POSTGRES_PORT=5434
```

Y ajusta `~/.vector-memory.env`:

```env
VECTOR_MEMORY_DATABASE_URL=postgres://vector:vector@localhost:5434/vector_memory
```

### 4. Crear el schema

```bash
vector-memory migrate
```

El comando es idempotente: crea tablas, indices HNSW/GIN y la columna generada
`search_vector` si aun no existen.

### 5. Verificar instalacion

```bash
vector-memory doctor
```

Deberias ver checks verdes para Node.js, variables de entorno, conexion a
PostgreSQL, extension `pgvector` y tabla `memories`.

### 6. Abrir worker + UI local

```bash
vector-memory worker --open
```

La UI queda disponible en `http://localhost:3010/ui`.

---

## Docker Compose completo

Normalmente no necesitas correr la API dentro de Docker: el CLI y el worker
local son mas comodos para agentes MCP. Si quieres levantar tambien el servicio
HTTP/API en contenedor:

```bash
vector-memory up --full
```

Esto activa el profile `full` del `docker-compose.yml` y expone la API en
`localhost:3010`.

---

## Desarrollo desde código fuente

Usa este flujo si vas a modificar el repo o contribuir cambios.

```bash
git clone https://github.com/cabupy/vector_memory_pg.git
cd vector_memory_pg
npm install
cp .env.example .env
```

Edita `.env`:

```env
VECTOR_MEMORY_DATABASE_URL=postgres://vector:vector@localhost:5433/vector_memory
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Levanta PostgreSQL con el compose del repo:

```bash
npm run up
```

Aplica el schema desde código fuente:

```bash
npm run setup
```

Verifica:

```bash
npm run cli doctor
```

Para usar el binario local en cualquier directorio durante desarrollo:

```bash
npm link
vector-memory doctor
```

---

## PostgreSQL nativo opcional

Solo necesitas esto si no quieres usar Docker.

### macOS con Homebrew

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
```

### Linux

Usa los paquetes de tu distro si incluyen `pgvector` para tu version exacta de
PostgreSQL. Si no, compila desde fuente:

```bash
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

`pgvector` debe compilarse contra la misma version de PostgreSQL que ejecuta tu
servidor.

### Crear base y extension

El nombre de usuario/base puede variar segun tu instalacion. Ejemplo:

```sql
CREATE DATABASE vector_memory_db;
\c vector_memory_db
CREATE EXTENSION IF NOT EXISTS vector;
```

Configura `~/.vector-memory.env` apuntando a tu base nativa:

```env
VECTOR_MEMORY_DATABASE_URL=postgresql://usuario:password@localhost:5432/vector_memory_db
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Luego aplica el schema:

```bash
vector-memory migrate
```

---

## Variables de entorno

| Variable | Descripcion | Default |
|---|---|---|
| `VECTOR_MEMORY_DATABASE_URL` | URL dedicada de PostgreSQL para vector-memory | recomendada |
| `DATABASE_URL` | Fallback de compatibilidad si no existe la var dedicada | — |
| `OPENAI_API_KEY` | API key de OpenAI para embeddings, auto-classify y reflect | requerida |
| `PORT` | Puerto del HTTP API/worker | `3010` |
| `INGEST_SECRET_MODE` | `block` o `redact` al detectar secretos | `block` |
| `MEMORY_ORGANIZATION` | Organizacion por defecto al ingestar | — |
| `MEMORY_PROJECT` | Proyecto por defecto al ingestar | — |
| `MEMORY_REPO_NAME` | Repo por defecto al ingestar | — |
| `MEMORY_TYPE` | Tipo de memoria por defecto al ingestar | tipo de fuente |
| `MEMORY_CRITICALITY` | Criticidad por defecto al ingestar | `normal` |
| `MEMORY_TAGS` | Tags por defecto al ingestar, separados por coma | — |

Para Docker Compose tambien puedes configurar:

| Variable | Descripcion | Default |
|---|---|---|
| `POSTGRES_USER` | Usuario del contenedor PostgreSQL | `vector` |
| `POSTGRES_PASSWORD` | Password del contenedor PostgreSQL | `vector` |
| `POSTGRES_DB` | Base creada por el contenedor | `vector_memory` |
| `POSTGRES_PORT` | Puerto expuesto en host | `5433` |
| `API_PORT` | Puerto del contenedor API con `--full` | `3010` |

---

## Comandos utiles

```bash
vector-memory up              # levanta PostgreSQL + pgvector en Docker
vector-memory up --full       # levanta PostgreSQL + API container
vector-memory down            # detiene los servicios Docker
vector-memory migrate         # aplica/actualiza schema SQL
vector-memory doctor          # verifica instalacion
vector-memory worker --open   # abre HTTP API + UI local
```
