# Integraciones con agentes IA

`vector-memory` se conecta a cualquier agente compatible con el protocolo MCP
(Model Context Protocol). El agente invoca las herramientas directamente: no
necesita saber de PostgreSQL ni de embeddings.

---

## Generar la configuracion MCP

Desde el directorio de tu proyecto (o desde cualquier lugar si tienes
`~/.vector-memory.env` configurado):

```bash
vector-memory mcp-config
```

Salida segura por defecto (reemplaza los placeholders en tu config final):

```json
{
  "mcpServers": {
    "vector-memory-pg": {
      "command": "vector-memory",
      "args": ["mcp"],
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
      }
    }
  }
}
```

Copia ese bloque en la configuracion de tu agente segun las instrucciones de
cada herramienta abajo. Si necesitas imprimir valores reales desde el entorno,
usa `vector-memory mcp-config --show-secrets` solo en una terminal segura.

---

## Claude Code

Agrega el servidor MCP al archivo de configuracion global de Claude Code:

**`~/.claude/claude_desktop_config.json`** (macOS/Linux)

```json
{
  "mcpServers": {
    "vector-memory-pg": {
      "command": "vector-memory",
      "args": ["mcp"],
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
      }
    }
  }
}
```

O directamente desde la terminal de Claude Code:

```bash
# dentro de una sesion de Claude Code
vector-memory mcp-config   # copia el JSON y pegalo en Settings > MCP
```

Una vez conectado, el agente puede usar frases como:
- *"Busca en mis memorias sobre rate limiting"*
- *"Guarda esta decision de arquitectura"*
- *"Que se trabajo recientemente en este proyecto?"*

### Flujo recomendado para Claude Code

Agrega esto a tu `CLAUDE.md` o `AGENTS.md`:

```markdown
Al inicio de cada tarea llama search_memories_compact con el tema principal.
Al final de cada sesion llama save_session_summary con lo trabajado.
```

---

## OpenCode

Edita `~/.config/opencode/config.json` (o el config que uses):

```json
{
  "mcp": {
    "servers": {
      "vector-memory-pg": {
        "command": "vector-memory",
        "args": ["mcp"],
        "env": {
          "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
          "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
        }
      }
    }
  }
}
```

O desde el CLI de OpenCode: `Ctrl+P` > `Add MCP Server` y pega la config.

### Flujo recomendado para OpenCode

Agrega esto a tu `AGENTS.md` en el proyecto:

```markdown
Al inicio: search_memories_compact con el tema de la tarea.
Si encuentras algo importante (bug, decision, patron): save_memory.
Al final: save_session_summary.
```

---

## Cursor

En Cursor, los servidores MCP se configuran en `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vector-memory-pg": {
      "command": "vector-memory",
      "args": ["mcp"],
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
      }
    }
  }
}
```

Reinicia Cursor despues de editar el archivo. Verifica que el servidor aparece
activo en Settings > MCP.

### Flujo recomendado para Cursor

Agrega esto a `.cursorrules`:

```
Al comenzar una tarea tecnica, usa search_memories_compact para buscar
conocimiento previo relevante. Si descubres algo util, guarda con save_memory.
Al terminar la sesion usa save_session_summary.
```

---

## Cualquier cliente MCP compatible

El servidor corre sobre stdio. Se puede integrar con cualquier cliente que
soporte MCP:

```bash
# arrancar el servidor MCP directamente
vector-memory mcp
```

O programaticamente si el cliente acepta config JSON:

```json
{
  "command": "vector-memory",
  "args": ["mcp"],
  "transport": "stdio"
}
```

---

## Herramientas disponibles para el agente

Una vez conectado, el agente tiene acceso a 11 herramientas:

| Herramienta | Para que sirve |
|---|---|
| `search_memories` | Busqueda semantica completa |
| `search_memories_compact` | Busqueda rapida (no satura el context window) |
| `get_memories` | Expandir resultados compactos |
| `recent_memories` | Ver trabajo reciente sin query semantica |
| `memory_timeline` | Historial cronologico por proyecto o periodo |
| `save_memory` | Guardar decision, bug, patron o hecho tecnico |
| `save_session_summary` | Resumen al final de la sesion |
| `update_memory` | Corregir o actualizar una memoria |
| `deprecate_memory` | Marcar como obsoleta |
| `verify_memory` | Confirmar que sigue siendo valida |
| `memory_stats` | Estado general de la base de conocimiento |

Ver [docs/mcp.md](./mcp.md) para la referencia completa de parametros.

---

## Verificar la conexion

Desde cualquier agente con el servidor MCP activo:

```
llama memory_stats
```

Deberia devolver conteos de memorias por tipo y status. Si falla, revisa
que `VECTOR_MEMORY_DATABASE_URL` y `OPENAI_API_KEY` esten correctos en la
config del servidor.
