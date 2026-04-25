# MCP Server

`vector_memory_pg` incluye un servidor MCP (Model Context Protocol) que expone herramientas de lectura y escritura de memoria para cualquier agente compatible.

Arrancar:

```bash
npm run mcp
```

---

## Configurar en tu agente

### OpenCode / Claude Code

Agregar al archivo de configuracion MCP (`~/.opencode/config.json` o equivalente):

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

### Cursor / Windsurf / cualquier agente MCP

El servidor corre por stdio. Configuracion generica:

```json
{
  "mcpServers": {
    "vector-memory": {
      "command": "node",
      "args": ["/ruta/a/vector_memory_pg/src/mcp-server.js"],
      "cwd": "/ruta/a/vector_memory_pg",
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "postgresql://usuario:password@localhost:5433/vector_memory_db",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

---

## Herramientas disponibles

### Lectura

| Herramienta | Descripcion |
|---|---|
| `search_memories` | Busca memorias por similitud semantica y ranking hibrido |
| `recent_memories` | Lista memorias recientes con filtros de metadata |
| `memory_stats` | Devuelve estadisticas basicas de la base de datos |

#### search_memories

```json
{
  "query": "rate limit JWT autenticacion",
  "limit": 5,
  "repo_name": "api-service",
  "organization": "ACME",
  "project": "demo-project",
  "memory_type": "security",
  "status": "active",
  "criticality": "high"
}
```

#### recent_memories

```json
{
  "limit": 10,
  "status": "active",
  "repo_name": "api-service"
}
```

---

### Escritura

| Herramienta | Descripcion |
|---|---|
| `save_memory` | Guarda una memoria manual con embedding y metadata |
| `update_memory` | Actualiza contenido o metadata; recalcula embedding si cambia el contenido |
| `deprecate_memory` | Marca una memoria como `deprecated` sin borrarla |
| `verify_memory` | Actualiza `last_verified_at` y registra auditoria en metadata |

#### save_memory

```json
{
  "content": "El rate limit de la API publica es 100 req/min por IP. Se implementa con Redis sliding window.",
  "organization": "ACME",
  "project": "demo-project",
  "repo_name": "api-service",
  "memory_type": "architecture",
  "criticality": "high",
  "tags": ["rate-limit", "redis", "api"],
  "author": "agent"
}
```

#### update_memory

```json
{
  "id": "manual_1234_abcd",
  "content": "Nuevo contenido actualizado.",
  "criticality": "critical",
  "reason": "Se cambio el limite a 50 req/min",
  "author": "agent"
}
```

Si se proporciona `content`, se recalcula el embedding automaticamente.

#### deprecate_memory

```json
{
  "id": "manual_1234_abcd",
  "reason": "Reemplazada por nueva arquitectura de rate limiting",
  "author": "agent"
}
```

#### verify_memory

```json
{
  "id": "manual_1234_abcd",
  "note": "Verificado: sigue siendo valido en v2.4",
  "author": "agent"
}
```

---

## Uso tipico desde un agente

Al iniciar una sesion de trabajo en un repo:

```
search_memories("reglas de seguridad api-service")
search_memories("decisiones de arquitectura pendientes")
recent_memories(limit=5, repo_name="api-service", status="active")
```

Al terminar una sesion relevante:

```
save_memory(
  content="Decidimos migrar de JWT stateless a sesiones Redis porque...",
  memory_type="decision",
  criticality="high",
  tags=["jwt", "redis", "auth"]
)
```

Para mantener vigencia:

```
verify_memory(id="...", note="Sigue vigente post-migracion v3")
deprecate_memory(id="...", reason="Reemplazado por decision del 2026-04-24")
```
