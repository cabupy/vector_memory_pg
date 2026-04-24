# Seguridad

Antes de ingestar cualquier archivo, el sistema aplica dos capas de proteccion para evitar que secretos o credenciales terminen en la base de datos.

---

## Capa 1 — Denylist de paths

Bloquea archivos por nombre o extension antes de leerlos:

| Patron | Ejemplos |
|---|---|
| Archivos `.env` | `.env`, `.env.local`, `.env.production` |
| Extensiones de clave | `*.pem`, `*.key` |
| Claves SSH | `id_rsa`, `id_ed25519` |
| Credenciales de servicio | `credentials.json`, `service-account.json` |
| Directorios de secretos | `secrets/`, `.secrets/` |

Si el path esta bloqueado, la ingesta falla inmediatamente y se registra en `sanitization_log`.

---

## Capa 2 — Detector de secretos por contenido

Escanea el contenido del archivo buscando patrones conocidos de secretos:

| Tipo | Patron detectado |
|---|---|
| `private_key` | `-----BEGIN ... PRIVATE KEY-----` |
| `openai_api_key` | `sk-...` (20+ caracteres) |
| `google_api_key` | `AIza...` |
| `aws_access_key` | `AKIA...` / `ASIA...` |
| `jwt` | Token JWT con tres segmentos base64 |
| `postgres_url` | `postgresql://user:pass@host/db` |
| `mongodb_url` | `mongodb+srv://user:pass@host/db` |
| `generic_secret` | `api_key = "..."`, `password: "..."`, etc. |

---

## Modos de operacion

Configurar via variable de entorno o flag del CLI/API:

### block (default)

Si se detecta un secreto, la ingesta se cancela y se registra el evento.

```env
INGEST_SECRET_MODE=block
```

```bash
vector-memory ingest --secret-mode block
```

### redact

El secreto se reemplaza con `[REDACTED:<tipo>]` antes de guardar. El archivo original no se modifica.

```env
INGEST_SECRET_MODE=redact
```

```bash
vector-memory ingest --secret-mode redact
```

Ejemplo de redaccion:

```text
# Antes
OPENAI_API_KEY=sk-proj-abc123XYZ...

# Despues (en la memoria guardada)
OPENAI_API_KEY=[REDACTED:openai_api_key]
```

---

## Dry-run

Simula la ingesta sin guardar nada. Muestra chunks, secretos detectados y modo aplicado:

```bash
vector-memory ingest --dry-run
```

Via CLI con archivo especifico:

```bash
node src/ingest-one.js archivo.md memory --dry-run
```

Via HTTP API:

```bash
curl -X POST http://localhost:3010/ingest \
  -H "Content-Type: application/json" \
  -d '{ "path": "archivo.md", "type": "memory", "dry_run": true }'
```

---

## Log de sanitizacion

Cada evento de bloqueo o redaccion se registra en la tabla `sanitization_log`.

Consultar via HTTP API:

```bash
curl "http://localhost:3010/sanitization-log?limit=20"
```

Campos del registro:

| Campo | Descripcion |
|---|---|
| `id` | ID autoincremental |
| `file_path` | Ruta del archivo afectado |
| `action` | `blocked_path`, `blocked_content`, `redacted` |
| `reason` | Descripcion del bloqueo |
| `findings` | Lista de secretos detectados (tipo y linea) |
| `created_at` | Timestamp del evento |

---

## Limitaciones conocidas

- El detector de secretos opera por linea, no por bloque multilinea.
- `generic_secret` puede generar falsos positivos en documentacion tecnica (ej. ejemplos de codigo con `password: "example"`).
- La redaccion no aplica a archivos bloqueados por denylist de paths.
