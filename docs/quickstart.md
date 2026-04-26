# Primer uso en 5 minutos

Esta guia asume que tienes Node.js 22+ y PostgreSQL 16+ con pgvector instalado.
Si no tienes PostgreSQL local, usa Docker (ver abajo).

---

## Opcion A — PostgreSQL local

### 1. Instalar

```bash
npm install -g vector-memory-pg
```

### 2. Config global

Crea `~/.vector-memory.env` con tus credenciales. Este archivo aplica desde
cualquier directorio, sin interferir con los `.env` de tus proyectos:

```env
VECTOR_MEMORY_DATABASE_URL=postgresql://usuario:password@localhost:5432/vector_memory_db
OPENAI_API_KEY=sk-...
```

### 3. Crear el schema

```bash
vector-memory setup
```

### 4. Verificar

```bash
vector-memory doctor
```

Deberias ver todos los checks en verde. Si falla la conexion, revisa el
`VECTOR_MEMORY_DATABASE_URL` y que la base de datos exista.

### 5. Levantar el servidor y abrir la UI

```bash
vector-memory worker --open
```

Abre `http://localhost:3010/ui` en el browser automaticamente.

---

## Opcion B — Docker (sin PostgreSQL local)

```bash
git clone https://github.com/cabupy/vector_memory_pg.git
cd vector_memory_pg
cp .env.example .env   # editar OPENAI_API_KEY y VECTOR_MEMORY_DATABASE_URL
docker compose up -d   # levanta PostgreSQL en puerto 5433
npm install
npm run setup
vector-memory worker --open
```

El `docker-compose.yml` expone PostgreSQL en el puerto `5433` para no
colisionar con una instalacion local en `5432`.

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
- [MCP tools](./mcp.md) — las 11 herramientas disponibles para agentes
- [Seguridad](./security.md) — denylist, deteccion de secretos, politica de contenido
