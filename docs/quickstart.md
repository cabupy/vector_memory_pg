# Primer uso en 5 minutos

Esta guia asume Node.js 22+ y Docker con Compose. PostgreSQL/pgvector se levanta
en Docker para que el flujo funcione igual en macOS, Linux y WSL2.

---

## Opcion A — Docker recomendado

### 1. Instalar

```bash
npm install -g vector-memory-pg
```

### 2. Config global

Crea `~/.vector-memory.env` con tus credenciales. Este archivo aplica desde
cualquier directorio, sin interferir con los `.env` de tus proyectos:

```env
VECTOR_MEMORY_DATABASE_URL=postgres://vector:vector@localhost:5433/vector_memory
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

### 3. Levantar PostgreSQL + pgvector

```bash
vector-memory up
```

### 4. Crear el schema

```bash
vector-memory migrate
```

### 5. Verificar

```bash
vector-memory doctor
```

Deberias ver todos los checks en verde. Si falla la conexion, revisa el
`VECTOR_MEMORY_DATABASE_URL` y que la base de datos exista.

### 6. Levantar el servidor y abrir la UI

```bash
vector-memory worker --open
```

Abre `http://localhost:3010/ui` en el browser automaticamente.

---

## Opcion B — Desarrollo desde source

```bash
git clone https://github.com/cabupy/vector_memory_pg.git
cd vector_memory_pg
npm install
cp .env.example .env   # editar OPENAI_API_KEY si hace falta
docker compose up -d   # levanta PostgreSQL en puerto 5433
npm run setup
npm run cli doctor
npm run server
```

El `docker-compose.yml` expone PostgreSQL en el puerto `5433` para no
colisionar con una instalacion local en `5432`.

Si prefieres PostgreSQL nativo, instala PostgreSQL 16+ y pgvector, configura
`VECTOR_MEMORY_DATABASE_URL` apuntando a tu base y ejecuta `vector-memory migrate`.

---

## Primer uso: guardar y buscar una memoria

### Desde la UI

1. Abre `http://localhost:3010/ui`
2. Ve a la vista **Search** y escribe cualquier consulta tecnica
3. Usa la vista **Stats** para ver el estado de tu base de datos

### Desde el CLI

```bash
# Ingestar documentacion de un proyecto
cd mi-proyecto/
vector-memory init-project
vector-memory ingest

# Buscar
vector-memory search "como se configura el rate limit"
```

### Desde curl

```bash
# Guardar una memoria
curl -X POST http://localhost:3010/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "El rate limit esta configurado en 100 req/min por IP en el API gateway.",
    "memory_type": "architecture",
    "criticality": "high",
    "tags": ["rate-limit", "api-gateway"]
  }'

# Buscar
curl "http://localhost:3010/query?q=rate+limit&limit=3"
```

---

## Conectar un agente IA (MCP)

Genera la configuracion para tu agente:

```bash
vector-memory mcp-config
```

Copia el JSON resultante al bloque `mcpServers` de tu agente (Claude Code,
OpenCode, Cursor, etc.) y reemplaza los placeholders de secretos. Ver
[docs/integrations.md](./integrations.md) para ejemplos especificos por herramienta.

---

## Proximos pasos

- [Integraciones con agentes IA](./integrations.md) — Claude Code, OpenCode, Cursor
- [CLI completo](./cli.md) — todos los comandos y flags
- [HTTP API](./http-api.md) — referencia de endpoints
- [MCP tools](./mcp.md) — las 12 herramientas disponibles para agentes
- [Seguridad](./security.md) — denylist, deteccion de secretos, politica de contenido
