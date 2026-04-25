# HTTP API

El servidor HTTP corre por defecto en `http://localhost:3010`.

Arrancar:

```bash
vector-memory worker
# o para abrir la UI en browser al iniciar:
vector-memory worker --open
```

---

## GET /ui — Interfaz web local

Abre la UI web en el browser para explorar memorias sin necesidad de curl.

```
http://localhost:3010/ui
```

Vistas disponibles:

| Vista | Descripcion |
|---|---|
| Search | Busqueda semantica con filtros |
| Recientes | Ultimas memorias guardadas |
| Timeline | Historial cronologico por proyecto o periodo |
| Stats | Conteos globales por tipo, status y criticidad |

Los archivos estaticos (`index.html`, `style.css`, `app.js`) se sirven desde `src/ui/` dentro del paquete. No requieren servidor externo ni dependencias frontend.

---

## GET /query — Buscar memorias

Busqueda hibrida: similitud vectorial + full-text search + boosts de metadata.

```bash
curl "http://localhost:3010/query?q=rate+limit+JWT&limit=5"
```

### Parametros

| Parametro | Tipo | Descripcion |
|---|---|---|
| `q` | string | Texto de busqueda (requerido) |
| `limit` | number | Cantidad de resultados (default: 5) |
| `organization` | string | Filtrar por organizacion |
| `project` | string | Filtrar por proyecto |
| `repo_name` | string | Filtrar por repositorio |
| `memory_type` | string | Filtrar por tipo de memoria |
| `status` | string | Filtrar por estado (`active`, `deprecated`, etc.) |
| `criticality` | string | Filtrar por criticidad |
| `tags` | string | Tags separados por coma |

Ejemplo con filtros:

```bash
curl "http://localhost:3010/query?q=rate+limit+JWT&repo_name=api-service&memory_type=security&status=active&limit=5"
```

### Respuesta

```json
[
  {
    "id": "...",
    "content": "...",
    "source_type": "docs",
    "source_path": "docs/security.md",
    "organization": "ACME",
    "project": "demo-project",
    "repo_name": "api-service",
    "memory_type": "security",
    "status": "active",
    "criticality": "high",
    "tags": ["auth", "jwt"],
    "score": 0.8412,
    "vector_score": 0.9102,
    "text_rank": 0.3210,
    "status_score": 0.08,
    "criticality_score": 0.08,
    "verification_score": -0.02
  }
]
```

---

## GET /recent — Memorias recientes

Lista las memorias mas recientes sin busqueda semantica.

```bash
curl "http://localhost:3010/recent?limit=10&status=active"
```

### Parametros

Acepta los mismos filtros de metadata que `/query` (sin `q`), mas:

| Parametro | Tipo | Descripcion |
|---|---|---|
| `limit` | number | Cantidad de resultados (default: 10) |

---

## GET /stats — Estadisticas

Devuelve conteos globales de la base de datos.

```bash
curl "http://localhost:3010/stats"
```

Respuesta:

```json
{
  "total": 1042,
  "by_status": {
    "active": 980,
    "deprecated": 42,
    "archived": 20
  },
  "by_type": {
    "session": 600,
    "docs": 200,
    "memory": 150,
    "decision": 92
  }
}
```

---

## POST /ingest — Ingestar un archivo

Ingesta un archivo del filesystem, aplica denylist y politica de secretos, y guarda los chunks con embeddings.

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

### Body

| Campo | Tipo | Descripcion |
|---|---|---|
| `path` | string | Ruta al archivo (requerido) |
| `type` | string | Tipo de fuente (`docs`, `session`, `memory`, etc.) |
| `organization` | string | Organizacion |
| `project` | string | Proyecto |
| `repo_name` | string | Repositorio |
| `memory_type` | string | Tipo de memoria |
| `criticality` | string | Criticidad (`low`, `normal`, `high`, `critical`) |
| `tags` | array | Lista de tags |
| `dry_run` | boolean | Simula sin guardar (default: false) |
| `secret_mode` | string | `block` o `redact` para esta ingesta |

---

## GET /sanitization-log — Log de seguridad

Consulta el historial de eventos de denylist y deteccion de secretos.

```bash
curl "http://localhost:3010/sanitization-log?limit=20"
```

### Parametros

| Parametro | Tipo | Descripcion |
|---|---|---|
| `limit` | number | Cantidad de registros (default: 20) |

Respuesta:

```json
[
  {
    "id": 1,
    "file_path": "secrets/api.key",
    "action": "blocked_path",
    "reason": "path bloqueado por politica de secretos: api.key",
    "findings": null,
    "created_at": "2026-04-24T03:00:00Z"
  }
]
```

Acciones posibles:

| Accion | Descripcion |
|---|---|
| `blocked_path` | Archivo bloqueado por denylist de paths |
| `blocked_content` | Archivo bloqueado por secreto detectado en contenido |
| `redacted` | Secreto detectado y redactado antes de guardar |

---

## Session events

Endpoints para integrar agentes con el ciclo de vida de la sesion.

### POST /events/session-start

Recibe contexto relevante automaticamente al inicio de sesion.

```bash
curl -X POST http://localhost:3010/events/session-start \
  -H "Content-Type: application/json" \
  -d '{ "session_id": "abc123", "project": "mi-proyecto" }'
```

### POST /events/post-tool-use

Observacion despues de un tool-use. Con `auto_save: true` guarda la observacion como memoria si es relevante.

```bash
curl -X POST http://localhost:3010/events/post-tool-use \
  -H "Content-Type: application/json" \
  -d '{ "session_id": "abc123", "tool_name": "Bash", "observation": "...", "auto_save": true }'
```

### POST /events/session-end

Guarda el resumen de la sesion al terminar.

```bash
curl -X POST http://localhost:3010/events/session-end \
  -H "Content-Type: application/json" \
  -d '{ "session_id": "abc123", "summary": "Se completo X, decision sobre Y, pendiente Z." }'
```
