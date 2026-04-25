# vector-memory — Instrucciones para agentes IA

Este documento es el system prompt de referencia para agentes que usan
`vector-memory` como memoria técnica persistente.

Cópialo en tu `AGENTS.md`, `CLAUDE.md`, `.cursorrules` o en el bloque
`systemPrompt` de tu configuración MCP.

---

## Qué es vector-memory

Una base de conocimiento técnico persistente respaldada por PostgreSQL + pgvector.
Cada fragmento de conocimiento se guarda con embedding semántico, metadata
estructurada y vigencia explícita. Las búsquedas combinan similitud vectorial
(70%), full-text (20%) y boosts por criticidad y verificación.

---

## Herramientas disponibles

| Herramienta | Cuándo usarla |
|---|---|
| `search_memories` | Buscar conocimiento técnico al inicio de una tarea |
| `search_memories_compact` | Búsqueda rápida para no saturar el context window |
| `get_memories` | Expandir resultados compactos obteniendo el contenido completo |
| `recent_memories` | Ver qué se trabajó recientemente sin query semántica |
| `memory_timeline` | Revisar el historial cronológico de un proyecto o período |
| `save_memory` | Guardar una decisión, bug, patrón o hecho técnico importante |
| `save_session_summary` | Guardar el resumen al **final** de cada sesión |
| `update_memory` | Corregir o actualizar una memoria existente |
| `deprecate_memory` | Marcar como obsoleta una memoria que ya no aplica |
| `verify_memory` | Confirmar que una memoria sigue siendo válida |
| `memory_stats` | Revisar el estado general de la base de conocimiento |

---

## Flujo estándar por sesión

### Al inicio
1. Llama `search_memories_compact` con el tema de la tarea para orientarte.
2. Si hay resultados relevantes, usa `get_memories` para leer los importantes.
3. Revisa `recent_memories` si necesitas continuidad con trabajo reciente.

### Durante la sesión
- Si descubres algo técnico importante (decisión de arquitectura, bug no obvio,
  patrón que funcionó, restricción del sistema), guárdalo con `save_memory`.
- Usa `update_memory` si una memoria existente quedó desactualizada.
- Usa `deprecate_memory` si algo que encontraste ya no aplica.

### Al final
- Llama `save_session_summary` con un resumen de lo trabajado:
  qué se hizo, qué decisiones se tomaron, qué quedó pendiente.

---

## Cómo escribir buenas memorias

**Sé específico.** Una memoria útil responde: *¿qué, por qué, cómo, cuándo aplica?*

```
# Bueno
"La columna search_vector en memories se genera automáticamente (GENERATED ALWAYS AS).
No incluirla en INSERT explícitos o fallará con error de columna generada. (2026-04)"

# Malo
"Hay un problema con search_vector"
```

**Campos recomendados al guardar:**
- `memory_type`: `decision`, `bug`, `architecture`, `pattern`, `constraint`, `security`, `session_summary`
- `criticality`: `low` / `normal` / `high` / `critical`
- `tags`: palabras clave para filtrado posterior
- `project` y `repo_name`: siempre que aplique

---

## Políticas de contenido

- Escribe `@no-memory` en cualquier parte del texto para que **no se guarde**.
  Útil para notas temporales o contenido que no debe persistir.
- Envuelve información sensible en `<private>...</private>`.
  El bloque se redactará como `[private]` antes de guardar.

```
# Ejemplo
La API key usada para pruebas fue <private>sk-test-abc123</private>.
El endpoint es https://api.ejemplo.com/v2.
```

---

## Filtros disponibles

Todas las herramientas de búsqueda aceptan filtros opcionales:

| Filtro | Descripción |
|---|---|
| `project` | Limitar a un proyecto específico |
| `organization` | Limitar a una organización |
| `repo_name` | Limitar a un repositorio |
| `memory_type` | Tipo de memoria (decision, bug, etc.) |
| `status` | `active` \| `deprecated` \| `superseded` \| `archived` |
| `criticality` | `low` \| `normal` \| `high` \| `critical` |
| `tags` | Lista de tags (AND implícito) |
| `types` | `session` \| `daily` \| `memory` \| `docs` \| `brain` |

---

## Vigencia y mantenimiento

- Las memorias tienen `status`: `active` (default), `deprecated`, `superseded`, `archived`.
- El ranking penaliza memorias `deprecated` (-0.25) y `archived` (-0.45).
- Usa `verify_memory` cuando confirmes que una memoria sigue siendo válida.
  Las memorias verificadas en los últimos 30 días reciben boost (+0.08) en el ranking.
- Cuando actualices algo que reemplaza a otro, usa `deprecate_memory` sobre el anterior
  y deja nota en `reason`.

---

## Event endpoints (HTTP worker)

Si el servidor HTTP está corriendo (`vector-memory worker`), el agente puede
integrarse con el ciclo de vida de la sesión vía HTTP:

```bash
# Inicio de sesión — recibe contexto relevante automáticamente
POST http://127.0.0.1:3010/events/session-start
{ "session_id": "abc123", "project": "mi-proyecto" }

# Observación post tool-use
POST http://127.0.0.1:3010/events/post-tool-use
{ "session_id": "abc123", "tool_name": "Bash", "observation": "...", "auto_save": true }

# Fin de sesión — guarda resumen
POST http://127.0.0.1:3010/events/session-end
{ "session_id": "abc123", "summary": "Se completó X, decisión sobre Y, pendiente Z." }
```

---

## Ejemplo de resumen de sesión

```
Trabajé en el módulo de ingesta de vector-memory. Problemas encontrados:
- search_vector no acepta INSERT explícito (columna generada).
- El chunker divide por saltos de línea dobles antes de aplicar el límite de tokens.

Decisiones:
- Mantener chunking por Markdown (separador ##) y JSONL línea a línea.
- Límite de chunk: 1500 chars con overlap 200.

Pendiente:
- Revisar comportamiento con archivos > 1MB.
- Agregar soporte para chunking de TypeScript.
```
