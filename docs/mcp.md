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
        "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
      }
    }
  }
}
```

---

## Herramientas disponibles (12)

### Lectura

| Herramienta | Descripcion |
|---|---|
| `search_memories` | Busca memorias por similitud semantica y ranking hibrido |
| `search_memories_compact` | Igual pero con snippet corto para minimizar uso de context window |
| `get_memories` | Recupera memorias completas por lista de IDs o public_ids |
| `recent_memories` | Lista memorias recientes con filtros de metadata |
| `memory_timeline` | Historial cronologico agrupado por fecha |
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

#### search_memories_compact

Igual que `search_memories` pero devuelve un snippet de 150 caracteres por memoria.
Util cuando necesitas orientarte rapido sin saturar el context window.

#### get_memories

```json
{ "ids": ["VM-000001", "VM-000042"] }
```

Acepta IDs internos o `public_id` formato `VM-XXXXXX`.

#### memory_timeline

```json
{
  "project": "demo-project",
  "from": "2026-04-01",
  "to": "2026-04-30",
  "limit": 50
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
| `save_session_summary` | Guarda el resumen de la sesion al finalizar |
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

Con `auto_classify: true` los campos omitidos (`memory_type`, `criticality`, `tags`) se infieren
automaticamente por IA (gpt-4o-mini). Solo se rellena lo que no fue provisto explicitamente.

```json
{
  "content": "El rate limit de la API publica es 100 req/min por IP.",
  "project": "demo-project",
  "auto_classify": true
}
```

La memoria quedara con `metadata.classification_source: "auto"` y `metadata.classification_confidence`.

#### save_session_summary

```json
{
  "summary": "Se completo X, decision sobre Y, pendiente Z.",
  "project": "demo-project",
  "repo_name": "api-service"
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

### Analisis

| Herramienta | Descripcion |
|---|---|
| `reflect_memories` | Analiza memorias recientes con IA y detecta contradicciones, duplicados y gaps |

#### reflect_memories

Analiza un conjunto de memorias recientes usando gpt-4o-mini y devuelve sugerencias.
**Solo sugiere, no modifica nada.**

```json
{
  "project": "demo-project",
  "repo_name": "api-service",
  "focus": "decisiones de arquitectura",
  "limit": 30
}
```

Respuesta:

```json
{
  "memories_analyzed": 24,
  "findings": [
    "Las memorias VM-000012 y VM-000031 describen decisiones contradictorias sobre el uso de Redis.",
    "No hay memorias sobre la estrategia de migracion de base de datos mencionada en VM-000005."
  ],
  "suggested_new_memories": [
    "Documentar la decision final entre Redis y Memcached para cache de sesiones."
  ],
  "suggested_deprecations": [
    { "id": "VM-000012", "reason": "Contradiccion con VM-000031 que es mas reciente." }
  ]
}
```

Usa `reflect_memories` periodicamente (semanal o por sprint) para mantener la base de conocimiento coherente.

---

## Uso tipico desde un agente

Al iniciar una sesion de trabajo en un repo:

```
search_memories("reglas de seguridad api-service")
search_memories("decisiones de arquitectura pendientes")
recent_memories(limit=5, repo_name="api-service", status="active")
```

Al guardar algo nuevo, dejando que la IA clasifique:

```
save_memory(
  content="Decidimos migrar de JWT stateless a sesiones Redis porque...",
  project="demo-project",
  auto_classify=true
)
```

O con clasificacion explicita:

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

Para analizar coherencia de la base:

```
reflect_memories(project="demo-project", limit=30)
```
