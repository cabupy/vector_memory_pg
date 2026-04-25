````md
# Roadmap de mejoras para `vector_memory_pg`
## Inspirado en `hindsight` y `claude-mem`

Este documento consolida las funcionalidades que conviene incorporar a `vector_memory_pg` tomando como referencia dos proyectos:

- `vectorize-io/hindsight`
- `thedotmack/claude-mem`

El objetivo no es copiarlos literalmente, sino incorporar las mejores ideas manteniendo la identidad de `vector_memory_pg`:

> Memoria técnica institucional para agentes IA de desarrollo, basada en PostgreSQL + pgvector + Full-Text Search + HTTP API + MCP.

---

# 1. Objetivo estratégico

`vector_memory_pg` ya tiene una base sólida:

- PostgreSQL + pgvector.
- OpenAI embeddings.
- HTTP API.
- MCP server.
- Búsqueda híbrida vectorial + full-text.
- Metadata por organización, proyecto y repo.
- Tipos de memoria.
- Estado/vigencia.
- Criticidad.
- Tags.
- CLI.
- Seguridad con denylist y detector de secretos.
- MCP tools de lectura y escritura.

El siguiente salto es convertirlo en una memoria:

- más automática;
- más inteligente;
- más fácil de instalar;
- más útil para agentes reales;
- más gobernable para equipos;
- más orientada al ciclo de vida completo de una sesión de desarrollo.

---

# 2. Diferenciación frente a otros proyectos

## 2.1 Hindsight

`hindsight` apunta a memoria general para agentes IA.

Conceptos fuertes:

- retain;
- recall;
- reflect;
- memory banks;
- extracción estructurada;
- entidades y relaciones;
- retrieval multi-estrategia;
- integraciones amplias;
- Docker quickstart;
- UI local;
- SDKs.

## 2.2 Claude-mem

`claude-mem` apunta muy fuerte a Claude Code y al flujo automático de sesiones.

Conceptos fuertes:

- instalación simple vía `npx`;
- hooks de ciclo de vida;
- captura automática de sesiones;
- worker local;
- web viewer;
- progressive disclosure;
- timeline;
- context injection;
- tags de privacidad;
- skill de búsqueda;
- citaciones de memoria.

## 2.3 vector_memory_pg

`vector_memory_pg` debe mantenerse enfocado en:

- agentes de desarrollo;
- repos reales;
- memoria técnica institucional;
- equipos;
- gobernanza;
- PostgreSQL;
- pgvector;
- Full-Text Search;
- MCP;
- API HTTP;
- seguridad;
- memoria verificable y auditable.

---

# 3. Funcionalidades a incorporar desde Hindsight

---

## 3.1 Agregar `reflect_memories`

### Objetivo

Incorporar una herramienta que permita analizar memorias existentes y generar nuevas conclusiones, contradicciones o consolidaciones.

Actualmente `vector_memory_pg` puede guardar y buscar memoria.

Con `reflect_memories`, el sistema también podría razonar sobre la memoria existente.

### Inspiración

En Hindsight existen tres operaciones conceptuales:

```text
retain  = guardar memoria
recall  = recuperar memoria
reflect = analizar memorias y generar nuevo conocimiento
````

En `vector_memory_pg` ya existen equivalentes a:

```text
retain  -> save_memory
recall  -> search_memories
```

Falta:

```text
reflect -> reflect_memories
```

### Funcionalidad propuesta

Agregar MCP tool y comando HTTP/CLI:

```text
reflect_memories
```

### Casos de uso

```text
- Detectar contradicciones entre memorias.
- Consolidar memorias repetidas.
- Sugerir memorias oficiales.
- Detectar memorias obsoletas.
- Sugerir memorias a deprecar.
- Resumir decisiones vigentes de un repo.
- Detectar riesgos técnicos recurrentes.
- Generar un resumen institucional por proyecto/repo.
```

### Ejemplo

Input:

```json
{
  "organization": "ACME",
  "project": "Platform",
  "repo_name": "auth-service",
  "scope": "repo",
  "focus": "security"
}
```

Output esperado:

```json
{
  "summary": "El repo auth-service tiene varias memorias relacionadas con JWT, rate limits y auditoría.",
  "findings": [
    {
      "type": "contradiction",
      "description": "Una memoria indica usar Node 18 y otra indica Node 20+ como estándar vigente.",
      "memory_ids": [101, 184],
      "suggested_action": "Deprecar la memoria más antigua y verificar la más reciente."
    },
    {
      "type": "consolidation",
      "description": "Existen tres memorias sobre rate limiting que pueden consolidarse en una regla oficial.",
      "memory_ids": [88, 91, 104],
      "suggested_memory": "Todos los endpoints públicos de auth-service deben tener rate limit y auditoría."
    }
  ],
  "suggested_new_memories": [
    {
      "memory_type": "security",
      "criticality": "high",
      "content": "Todos los endpoints públicos de auth-service deben tener rate limit y auditoría.",
      "status": "active"
    }
  ],
  "suggested_deprecations": [88, 91]
}
```

### Reglas importantes

* No modificar automáticamente memorias críticas sin confirmación.
* `reflect_memories` puede sugerir acciones, pero no necesariamente aplicarlas.
* Para aplicar cambios usar:

  * `save_memory`;
  * `update_memory`;
  * `deprecate_memory`;
  * `verify_memory`.

### Prioridad

Alta.

---

## 3.2 Agregar `memory_bank`

### Objetivo

Agregar una capa flexible de agrupación superior o paralela a `organization/project/repo_name`.

Hoy el namespace está orientado a repos, lo cual está bien. Pero hay memorias que no pertenecen a un repo específico.

### Campo sugerido

```sql
memory_bank TEXT
```

### Ejemplos

```text
acme/auth-service
acme/platform-engine
acme/security-standards
acme/devops-playbook
contoso/geoops-api
contoso/architecture
contoso/field-operations
globex/onboarding-service
```

### Casos de uso

```text
- Memorias por repo.
- Memorias institucionales.
- Estándares de seguridad.
- Playbooks DevOps.
- Integraciones con clientes.
- Incidentes de producción.
- Decisiones de arquitectura globales.
```

### Ejemplo de memoria no asociada a repo

```json
{
  "organization": "ACME",
  "memory_bank": "acme/security-standards",
  "memory_type": "security",
  "criticality": "critical",
  "content": "Todo servicio público debe aplicar rate limiting, logging de auditoría y validación de JWT cuando corresponda."
}
```

### Reglas

* Si `repo_name` existe, `memory_bank` puede derivarse automáticamente.
* Si no hay `repo_name`, `memory_bank` debe ser obligatorio.
* `memory_bank` debe poder usarse como filtro en:

  * search;
  * recent;
  * reflect;
  * timeline;
  * stats.

### Prioridad

Alta.

---

## 3.3 Auto-clasificación al guardar memoria

### Objetivo

Cuando se guarda una memoria, permitir que el sistema sugiera automáticamente:

* tipo de memoria;
* criticidad;
* tags;
* entidades;
* vigencia;
* estado inicial;
* posible repo/proyecto;
* si parece duplicada;
* si contradice otra memoria.

### MCP tool existente a extender

```text
save_memory
```

### Nuevo parámetro

```json
{
  "auto_classify": true
}
```

### Ejemplo

Input:

```json
{
  "content": "El módulo de pagos tiene una condición de carrera cuando dos workers procesan el mismo transaction_id.",
  "organization": "ACME",
  "project": "Payments",
  "repo_name": "payments-service",
  "auto_classify": true
}
```

Output sugerido:

```json
{
  "memory_type": "bug",
  "criticality": "high",
  "tags": ["payments", "concurrency", "transaction_id", "workers"],
  "entities": [
    {
      "name": "payments-service",
      "type": "repo"
    },
    {
      "name": "transaction_id",
      "type": "field"
    }
  ],
  "status": "active",
  "confidence": 0.91
}
```

### Reglas

* La auto-clasificación debe poder ser desactivada.
* Si usa LLM, debe tener fallback manual.
* No debe clasificar secretos.
* Debe respetar el sistema de seguridad block/redact antes de enviar texto a un modelo externo.
* Debe guardar en metadata si la clasificación fue:

  * manual;
  * automática;
  * corregida por humano.

### Campos sugeridos

```sql
classification_source TEXT DEFAULT 'manual'
classification_confidence NUMERIC
```

Valores:

```text
manual
auto
human_corrected
```

### Prioridad

Alta.

---

## 3.4 Extracción de entidades y relaciones

### Objetivo

Agregar estructura semántica adicional a cada memoria.

Esto permite búsquedas más precisas que solo vector + full-text.

### Campos simples sugeridos

```sql
entities JSONB DEFAULT '[]'
relationships JSONB DEFAULT '[]'
```

### Ejemplo de entidades

```json
[
  {
    "name": "ExternalProvider",
    "type": "provider"
  },
  {
    "name": "auth-service",
    "type": "repo"
  },
  {
    "name": "JWT",
    "type": "technology"
  }
]
```

### Ejemplo de relaciones

```json
[
  {
    "subject": "auth-service",
    "relation": "uses",
    "object": "JWT"
  },
  {
    "subject": "payments-service",
    "relation": "integrates_with",
    "object": "ExternalProvider"
  }
]
```

### Casos de uso

```text
- Buscar todas las memorias relacionadas con ExternalProvider.
- Buscar qué servicios usan JWT.
- Buscar memorias donde transaction_id aparece como entidad.
- Identificar integraciones externas por proyecto.
- Construir un mapa técnico institucional.
```

### Búsqueda por entidad

Agregar filtros:

```json
{
  "entity": "ExternalProvider"
}
```

```json
{
  "entity_type": "provider"
}
```

### Prioridad

Media-alta.

---

## 3.5 Retrieval temporal

### Objetivo

Permitir búsquedas y análisis basados en tiempo.

### Campos necesarios

Ya existen o deberían existir:

```sql
created_at
updated_at
last_verified_at
valid_from
valid_until
```

Agregar si no existen:

```sql
event_date TIMESTAMP
```

### Casos de uso

```text
- ¿Qué cambió este mes?
- ¿Qué decisiones fueron verificadas recientemente?
- ¿Qué memorias están vencidas?
- ¿Qué bugs se registraron en marzo?
- ¿Qué contexto rodeó la migración a Node 20?
```

### Filtros sugeridos

```json
{
  "date_from": "2026-01-01",
  "date_to": "2026-01-31"
}
```

```json
{
  "verified_after": "2026-01-01"
}
```

```json
{
  "only_expired": true
}
```

### Prioridad

Media.

---

## 3.6 Ranking multi-estrategia

### Objetivo

Ampliar el scoring actual para combinar más señales.

Actualmente ya existe búsqueda híbrida:

```text
vector_score + text_rank + status + criticality + last_verified_at
```

Agregar señales:

```text
entity_score
temporal_score
governance_score
repo_match_score
bank_match_score
verified_score
```

### Scoring conceptual

```text
final_score =
  semantic_score * 0.35 +
  keyword_score * 0.25 +
  entity_score * 0.15 +
  temporal_score * 0.10 +
  governance_score * 0.15
```

### Governance score

Debe subir cuando:

```text
- status = active
- memory is verified
- criticality is high/critical
- classification_source = manual o human_corrected
- last_verified_at es reciente
```

Debe bajar cuando:

```text
- status = deprecated
- status = archived
- valid_until venció
- memory no fue verificada hace mucho
```

### Prioridad

Media-alta.

---

## 3.7 Docker one-command

### Objetivo

Facilitar adopción.

El usuario debería poder levantar todo con Docker Compose.

### Comando deseado

```bash
docker compose up
```

O desde CLI:

```bash
vector-memory up
```

### Componentes

```text
- PostgreSQL 16+
- pgvector
- API HTTP
- MCP server
- worker/daemon
- UI local futura
```

### Archivos sugeridos

```text
docker-compose.yml
Dockerfile
.env.example
```

### Ejemplo deseado

```bash
git clone https://github.com/cabupy/vector_memory_pg
cd vector_memory_pg
cp .env.example .env
docker compose up
```

### Prioridad

Alta.

---

## 3.8 Clientes oficiales

### Objetivo

Facilitar integración desde aplicaciones externas.

### Paquetes sugeridos

```text
@cabupy/vector-memory-client
vector-memory-pg Python client
```

### Cliente JS/TS

Ejemplo deseado:

```js
import { VectorMemory } from "@cabupy/vector-memory-client";

const memory = new VectorMemory({
  baseUrl: "http://localhost:3010",
  apiKey: process.env.VECTOR_MEMORY_API_KEY
});

await memory.save({
  content: "Use UUID v7 for new database IDs.",
  repo: "auth-service",
  type: "decision"
});

const results = await memory.search({
  query: "ID generation strategy",
  repo: "auth-service"
});
```

### Cliente Python

Ejemplo deseado:

```python
from vector_memory_pg import VectorMemory

memory = VectorMemory(base_url="http://localhost:3010")

memory.save(
    content="Use UUID v7 for new database IDs.",
    repo="auth-service",
    type="decision"
)

results = memory.search(
    query="ID generation strategy",
    repo="auth-service"
)
```

### Prioridad

Media.

---

## 3.9 Cookbook / examples

### Objetivo

Facilitar comprensión y adopción.

### Estructura sugerida

```text
cookbook/
  claude-code-memory.md
  opencode-memory.md
  openclaw-memory.md
  cursor-memory.md
  mcp-save-and-recall.md
  architecture-decisions.md
  known-bugs.md
  security-rules.md
  payments-bug-memory.md
```

### Ejemplos prácticos

```text
- Cómo guardar una decisión de arquitectura.
- Cómo consultar reglas de seguridad antes de tocar código.
- Cómo deprecar una memoria antigua.
- Cómo verificar una memoria.
- Cómo usar memoria por repo.
- Cómo usar memoria institucional no asociada a repo.
```

### Prioridad

Alta para adopción.

---

## 3.10 Benchmark técnico propio

### Objetivo

Medir calidad real de recuperación y gobernanza.

### Casos de prueba sugeridos

```text
1. Recupera la decisión correcta del repo.
2. Evita usar una memoria deprecated.
3. Prioriza una memoria verified sobre una vieja.
4. Detecta contradicciones.
5. Detecta memorias duplicadas.
6. Recupera por entidad.
7. Recupera por keyword exacta.
8. Recupera por similitud semántica.
9. Recupera por fecha.
10. Respeta filtros por repo/proyecto/bank.
```

### Dataset sugerido

Crear un dataset de ejemplo:

```text
benchmarks/
  fixtures/
    memories.json
    queries.json
```

### Output esperado

```text
precision@5
recall@5
deprecated_leak_rate
verified_priority_rate
contradiction_detection_rate
```

### Prioridad

Media.

---

# 4. Funcionalidades a incorporar desde Claude-mem

---

## 4.1 Instalador vía `npx`

### Objetivo

Mejorar la experiencia inicial.

En vez de exigir instalación manual compleja, permitir:

```bash
npx @cabupy/vector-memory-pg install
```

O si el paquete no está bajo scope:

```bash
npx vector-memory-pg install
```

### Qué debe hacer el instalador

```text
1. Verificar versión de Node.js.
2. Verificar Docker.
3. Verificar si existe PostgreSQL local.
4. Preguntar si desea usar Docker o DB existente.
5. Crear archivo de configuración local.
6. Crear `.env`.
7. Pedir OPENAI_API_KEY.
8. Levantar PostgreSQL + pgvector si corresponde.
9. Ejecutar migraciones.
10. Verificar conexión.
11. Configurar MCP server.
12. Mostrar instrucciones para Claude Code / OpenCode / OpenClaw.
13. Ejecutar doctor.
```

### Comandos deseados

```bash
npx @cabupy/vector-memory-pg install
```

```bash
vector-memory quickstart
```

```bash
vector-memory doctor
```

### Importante

No hacer todo durante `npm install -g`.

El `npm install -g` solo debe instalar la CLI.

El montaje debe ocurrir con:

```bash
vector-memory quickstart
```

o:

```bash
npx @cabupy/vector-memory-pg install
```

### Prioridad

Muy alta.

---

## 4.2 `vector-memory worker` / daemon local

### Objetivo

Crear un proceso local permanente o semipermanente para recibir eventos, procesar memoria y servir API/MCP.

### Comando

```bash
vector-memory worker
```

o:

```bash
vector-memory daemon
```

### Responsabilidades

```text
- Levantar HTTP API.
- Servir MCP.
- Recibir eventos de hooks.
- Encolar observaciones.
- Procesar embeddings.
- Generar resúmenes de sesión.
- Aplicar sanitización.
- Registrar logs.
- Ejecutar tareas de mantenimiento.
```

### Endpoints internos posibles

```text
POST /events/session-start
POST /events/user-prompt
POST /events/post-tool-use
POST /events/session-end
POST /events/observation
POST /events/summary
```

### Prioridad

Alta.

---

## 4.3 Hooks de ciclo de vida

### Objetivo

Capturar automáticamente contexto y aprendizajes durante sesiones con agentes.

### Hooks deseados

```text
SessionStart
UserPromptSubmit
PostToolUse
Stop
SessionEnd
```

### Flujo ideal

```text
SessionStart:
- detectar repo actual
- recuperar memorias relevantes
- inyectar contexto crítico

UserPromptSubmit:
- analizar intención del usuario
- buscar memorias relevantes a la tarea

PostToolUse:
- capturar observaciones técnicas luego de leer/editar archivos
- detectar posibles aprendizajes

Stop:
- preparar resumen de sesión

SessionEnd:
- guardar resumen estructurado
- sugerir memorias nuevas
- detectar cambios importantes
```

### Ejemplo

Al iniciar una sesión en `auth-service`:

```text
1. El hook detecta repo_name = auth-service.
2. Busca memorias críticas vigentes.
3. Recupera reglas de seguridad.
4. Inyecta contexto:
   - Usar Node 20+
   - No interpolar SQL
   - Endpoints públicos requieren rate limit
   - JWT debe validarse con middleware central
```

### Prioridad

Muy alta.

---

## 4.4 Captura automática `PostToolUse`

### Objetivo

Detectar aprendizajes importantes a partir de herramientas usadas por el agente.

### Casos

Después de que el agente:

```text
- lee archivos;
- modifica código;
- ejecuta tests;
- encuentra errores;
- analiza logs;
- inspecciona configuración;
- revisa package.json;
- mira migraciones;
```

el sistema puede generar observaciones candidatas.

### Ejemplo de observación candidata

```json
{
  "source": "PostToolUse",
  "repo_name": "auth-service",
  "observation": "El repo usa Express 5 y middleware centralizado para validación JWT.",
  "suggested_memory_type": "architecture",
  "criticality": "normal",
  "requires_approval": true
}
```

### Reglas

* No guardar todo automáticamente como memoria oficial.
* Guardar como `agent_observation` o `temporary`.
* Permitir promoción posterior a `official`.
* Sanitizar antes de guardar.
* Respetar `<private>` y `@no-memory`.

### Prioridad

Alta.

---

## 4.5 `SessionEnd summary`

### Objetivo

Guardar un resumen estructurado al terminar una sesión.

### Tool sugerida

```text
save_session_summary
```

### Contenido del resumen

```text
- Objetivo de la sesión.
- Archivos principales tocados.
- Decisiones tomadas.
- Bugs detectados.
- Cambios realizados.
- Tests ejecutados.
- Pendientes.
- Memorias sugeridas.
- Memorias a deprecar.
```

### Ejemplo

```json
{
  "repo_name": "payments-service",
  "session_summary": {
    "goal": "Revisar condición de carrera en procesamiento de pagos.",
    "files_touched": [
      "src/workers/payment-worker.js",
      "src/services/payment-lock.js"
    ],
    "findings": [
      "Dos workers pueden procesar el mismo transaction_id sin lock distribuido."
    ],
    "decisions": [
      "Agregar lock transaccional antes de procesar pagos."
    ],
    "pending": [
      "Agregar test de concurrencia."
    ]
  }
}
```

### Prioridad

Alta.

---

## 4.6 `SessionStart context injection`

### Objetivo

Inyectar memoria relevante al inicio de una sesión.

### Configuración por repo

Archivo sugerido:

```text
.vector-memory.json
```

Ejemplo:

```json
{
  "contextInjection": {
    "enabled": true,
    "maxTokens": 1500,
    "includeTypes": ["security", "architecture", "decision", "bug"],
    "onlyVerified": true,
    "includeCriticalAlways": true
  }
}
```

### Reglas

* No inyectar demasiada memoria.
* Priorizar:

  * memorias críticas;
  * verificadas;
  * del mismo repo;
  * activas;
  * recientes;
  * relevantes a la tarea.
* Excluir:

  * deprecated;
  * archived;
  * vencidas;
  * privadas;
  * no verificadas si la política lo indica.

### Prioridad

Muy alta.

---

## 4.7 Progressive disclosure MCP

### Objetivo

Reducir consumo de tokens y mejorar precisión.

En vez de devolver siempre memorias completas, usar tres niveles:

```text
1. search_memories_compact
2. memory_timeline
3. get_memories
```

### 4.7.1 `search_memories_compact`

Devuelve tarjetas compactas:

```json
[
  {
    "id": "VM-1042",
    "title": "Rate limit required on public endpoints",
    "memory_type": "security",
    "criticality": "high",
    "status": "active",
    "verified": true,
    "repo_name": "auth-service",
    "score": 0.91
  }
]
```

No devuelve todo el contenido salvo un snippet muy corto.

### 4.7.2 `memory_timeline`

Devuelve contexto cronológico alrededor de una memoria, repo o query.

Ejemplo:

```json
{
  "repo_name": "auth-service",
  "events": [
    {
      "date": "2026-01-10",
      "id": "VM-900",
      "title": "Migrated to Node 20"
    },
    {
      "date": "2026-01-14",
      "id": "VM-1042",
      "title": "Rate limit required on public endpoints"
    }
  ]
}
```

### 4.7.3 `get_memories`

Devuelve memorias completas solo por IDs seleccionados.

```json
{
  "ids": ["VM-1042", "VM-900"]
}
```

### Beneficio

```text
- Menos tokens.
- Mejor control.
- El agente primero explora, luego expande.
- Evita traer ruido.
```

### Prioridad

Muy alta.

---

## 4.8 Timeline

### Objetivo

Agregar vista cronológica de memorias.

### MCP tool

```text
memory_timeline
```

### Filtros

```json
{
  "organization": "ACME",
  "project": "Platform",
  "repo_name": "auth-service",
  "date_from": "2026-01-01",
  "date_to": "2026-01-31",
  "memory_type": "decision"
}
```

### Casos de uso

```text
- ¿Qué pasó antes de este bug?
- ¿Qué decisiones se tomaron durante la migración?
- ¿Qué cambió este mes?
- ¿Qué memorias rodean a esta memoria?
- ¿Cuándo se deprecó una regla?
```

### Prioridad

Alta.

---

## 4.9 UI / Web viewer local

### Objetivo

Permitir visualizar y gobernar memoria desde navegador.

### Comando

```bash
vector-memory ui
```

o levantarla junto al worker:

```bash
vector-memory worker --ui
```

### URL sugerida

```text
http://localhost:3010/ui
```

### Funciones mínimas

```text
- Buscar memorias.
- Filtrar por organización/proyecto/repo.
- Filtrar por memory_bank.
- Filtrar por tipo.
- Filtrar por status.
- Filtrar por criticidad.
- Ver detalle de memoria.
- Editar memoria.
- Deprecar memoria.
- Verificar memoria.
- Ver timeline.
- Ver duplicados sugeridos.
- Ver contradicciones sugeridas.
```

### Funciones futuras

```text
- Promover agent_observation a official.
- Aprobar memorias sugeridas.
- Dashboard por repo.
- Métricas.
- Vista de entidades.
- Vista de relaciones.
```

### Prioridad

Media-alta.

---

## 4.10 Context injection configurable

### Objetivo

Permitir controlar qué memoria se entrega al agente.

### Configuración sugerida

```json
{
  "contextInjection": {
    "enabled": true,
    "maxTokens": 1500,
    "maxMemories": 8,
    "includeTypes": [
      "security",
      "architecture",
      "decision",
      "bug",
      "convention"
    ],
    "excludeTypes": [
      "deprecated"
    ],
    "onlyVerified": false,
    "includeCriticalAlways": true,
    "preferSameRepo": true,
    "preferRecentVerified": true
  }
}
```

### Reglas

* Las memorias críticas activas siempre deben tener prioridad.
* Las memorias deprecated nunca deben inyectarse salvo que se pida explícitamente.
* Las memorias no verificadas pueden inyectarse con advertencia.
* El agente debe saber si una memoria es:

  * official;
  * agent_observation;
  * temporary;
  * deprecated.

### Prioridad

Alta.

---

## 4.11 Tags de privacidad: `<private>` y `@no-memory`

### Objetivo

Permitir al usuario excluir contenido manualmente de la memoria.

### Sintaxis propuesta

```text
<private>
contenido que no debe guardarse
</private>
```

Y también:

```text
@no-memory
```

### Comportamiento

Si el sistema encuentra `<private>`:

```text
- no indexar ese contenido;
- no generar embedding;
- no enviarlo a OpenAI;
- no guardarlo en logs;
- reemplazarlo por [PRIVATE_BLOCK_REDACTED] si hace falta.
```

Si encuentra `@no-memory` en un mensaje/sesión:

```text
- no guardar la entrada completa;
- registrar opcionalmente un evento mínimo sin contenido.
```

### Prioridad

Alta.

---

## 4.12 Skill de búsqueda para agentes

### Objetivo

Crear instrucciones/skill para que Claude Code/OpenCode/OpenClaw usen memoria correctamente.

### Nombre sugerido

```text
vector-memory-search
```

### Reglas de la skill

```text
- Antes de modificar código, buscar memorias relevantes del repo.
- Si hay memorias críticas activas, respetarlas.
- Si hay memorias deprecated, no usarlas como fuente vigente.
- Si aprende una decisión importante, sugerir guardarla.
- Si detecta contradicciones, avisar.
- Si se usa una memoria, citar su ID.
```

### Ejemplo de instrucción

```text
Before implementing changes, search vector_memory_pg for relevant memories using the current repo name, task description, and affected module. Prefer active, verified, high-criticality memories. Do not rely on deprecated memories unless explicitly requested.
```

### Prioridad

Alta.

---

## 4.13 Citaciones de memoria por ID

### Objetivo

Permitir que el agente indique qué memoria usó.

### Formato sugerido

```text
VM-1042
```

O:

```text
mem_1042
```

### Ejemplo de respuesta de agente

```text
Voy a aplicar rate limit porque existe una memoria crítica vigente:

VM-1042 — security — auth-service — verified
"Todos los endpoints públicos deben tener rate limit y auditoría."
```

### Campos sugeridos

```sql
public_id TEXT UNIQUE
```

Ejemplo:

```text
VM-000001
VM-000002
VM-000003
```

### Prioridad

Alta.

---

## 4.14 Observaciones candidatas vs memorias oficiales

### Objetivo

Evitar que todo lo que detecta el agente se convierta en verdad oficial.

### Nuevo campo sugerido

```sql
authority TEXT DEFAULT 'developer_note'
```

Valores:

```text
official
agent_observation
developer_note
temporary
deprecated
```

### Flujo sugerido

```text
1. El agente detecta algo.
2. Se guarda como agent_observation.
3. Un humano o proceso de reflexión la revisa.
4. Se promueve a official si corresponde.
```

### Ejemplo

```json
{
  "authority": "agent_observation",
  "content": "El agente observó que algunos endpoints parecen no tener rate limit.",
  "requires_review": true
}
```

### Prioridad

Alta.

---

# 5. Mejoras de instalación y empaquetado

---

## 5.1 Publicar paquete npm

### Nombre sugerido

```text
@cabupy/vector-memory-pg
```

### Alternativa

```text
vector-memory-pg
```

### Recomendación

Usar scope:

```text
@cabupy/vector-memory-pg
```

### package.json

Ejemplo:

```json
{
  "name": "@cabupy/vector-memory-pg",
  "version": "1.6.0",
  "description": "Persistent semantic memory for AI coding agents using PostgreSQL, pgvector, AI embeddings, HTTP API, and MCP.",
  "type": "module",
  "bin": {
    "vector-memory": "./bin/vector-memory.js"
  },
  "files": [
    "bin",
    "src",
    "sql",
    "docs",
    "README.md",
    "CHANGELOG.md",
    "package.json"
  ],
  "engines": {
    "node": ">=18"
  }
}
```

### bin/vector-memory.js

```js
#!/usr/bin/env node

import '../src/cli.js';
```

### Prioridad

Muy alta.

---

## 5.2 Comandos CLI finales deseados

```bash
vector-memory install
vector-memory quickstart
vector-memory setup
vector-memory up
vector-memory down
vector-memory worker
vector-memory ui
vector-memory doctor
vector-memory migrate
vector-memory init-project
vector-memory ingest
vector-memory search "query"
vector-memory recent
vector-memory stats
vector-memory mcp
vector-memory mcp-config
vector-memory reflect
vector-memory timeline
```

### Prioridad

Alta.

---

## 5.3 `quickstart`

### Objetivo

Un solo comando para dejar todo funcionando.

```bash
vector-memory quickstart
```

### Debe hacer

```text
1. Crear configuración.
2. Crear `.env`.
3. Verificar OpenAI API key.
4. Verificar Docker/PostgreSQL.
5. Levantar DB si hace falta.
6. Aplicar migraciones.
7. Inicializar proyecto si está en un repo git.
8. Ingerir archivos base si el usuario acepta.
9. Mostrar configuración MCP.
10. Ejecutar doctor final.
```

### Output esperado

```text
✅ PostgreSQL + pgvector running
✅ Schema migrated
✅ HTTP API ready
✅ MCP server ready
✅ Project initialized
✅ Try: vector-memory search "architecture decisions"
```

### Prioridad

Muy alta.

---

## 5.4 `doctor`

### Objetivo

Diagnosticar instalación.

### Checks

```text
- Node version.
- Package version.
- Docker available.
- PostgreSQL reachable.
- pgvector installed.
- Schema version.
- OpenAI API key present.
- Embedding model configured.
- MCP server executable.
- HTTP API reachable.
- Current repo detected.
- .vector-memory.json valid.
- Security config valid.
```

### Prioridad

Alta.

---

## 5.5 `mcp-config`

### Objetivo

Generar configuración MCP copiable.

### Comando

```bash
vector-memory mcp-config
```

### Output ejemplo

```json
{
  "mcpServers": {
    "vector-memory-pg": {
      "command": "vector-memory",
      "args": ["mcp"],
      "env": {
        "DATABASE_URL": "postgres://vector:vector@localhost:5432/vector_memory",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
      }
    }
  }
}
```

### Variantes

```bash
vector-memory mcp-config --target claude-code
vector-memory mcp-config --target opencode
vector-memory mcp-config --target openclaw
vector-memory mcp-config --target cursor
```

### Prioridad

Alta.

---

# 6. Seguridad adicional

---

## 6.1 Mantener detector de secretos

Ya existe, pero debe ampliarse.

### Detectar

```text
OPENAI_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
JWT
PRIVATE KEY
DATABASE_URL con password
GitHub tokens
Slack tokens
Stripe keys
Twilio tokens
Google service accounts
.env files
.pem files
.key files
```

### Modos

```text
block
redact
warn
off
```

### Prioridad

Muy alta.

---

## 6.2 Respetar `<private>` y `@no-memory`

Ya definido en sección 4.11.

Debe integrarse antes de:

```text
- chunking;
- embeddings;
- storage;
- logs;
- reflection;
- auto-classification.
```

### Prioridad

Alta.

---

## 6.3 Approval workflow

### Objetivo

Evitar que memoria generada automáticamente se vuelva oficial sin control.

### Campos

```sql
requires_review BOOLEAN DEFAULT false
reviewed_by TEXT
reviewed_at TIMESTAMP
approved BOOLEAN DEFAULT false
```

### Prioridad

Media-alta.

---

# 7. Schema sugerido

Agregar o verificar estos campos en `memories`:

```sql
organization TEXT
project TEXT
repo_name TEXT
branch TEXT
environment TEXT
owner TEXT

memory_bank TEXT

memory_type TEXT
authority TEXT DEFAULT 'developer_note'
status TEXT DEFAULT 'active'
criticality TEXT DEFAULT 'normal'
tags TEXT[] DEFAULT '{}'

entities JSONB DEFAULT '[]'
relationships JSONB DEFAULT '[]'

public_id TEXT UNIQUE

classification_source TEXT DEFAULT 'manual'
classification_confidence NUMERIC

confidence NUMERIC
valid_from TIMESTAMP
valid_until TIMESTAMP
last_verified_at TIMESTAMP
updated_at TIMESTAMP
event_date TIMESTAMP

superseded_by BIGINT
supersedes BIGINT[]

requires_review BOOLEAN DEFAULT false
reviewed_by TEXT
reviewed_at TIMESTAMP
approved BOOLEAN DEFAULT false

metadata JSONB DEFAULT '{}'
```

Checks sugeridos:

```sql
CHECK (status IN ('active', 'deprecated', 'superseded', 'archived'))
CHECK (criticality IN ('low', 'normal', 'high', 'critical'))
CHECK (authority IN ('official', 'agent_observation', 'developer_note', 'temporary', 'deprecated'))
CHECK (classification_source IN ('manual', 'auto', 'human_corrected'))
```

Índices sugeridos:

```sql
CREATE INDEX IF NOT EXISTS idx_memories_namespace
ON memories (organization, project, repo_name);

CREATE INDEX IF NOT EXISTS idx_memories_bank
ON memories (memory_bank);

CREATE INDEX IF NOT EXISTS idx_memories_status
ON memories (status);

CREATE INDEX IF NOT EXISTS idx_memories_type
ON memories (memory_type);

CREATE INDEX IF NOT EXISTS idx_memories_criticality
ON memories (criticality);

CREATE INDEX IF NOT EXISTS idx_memories_tags
ON memories USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_memories_entities
ON memories USING GIN (entities);

CREATE INDEX IF NOT EXISTS idx_memories_relationships
ON memories USING GIN (relationships);

CREATE INDEX IF NOT EXISTS idx_memories_public_id
ON memories (public_id);

CREATE INDEX IF NOT EXISTS idx_memories_timeline
ON memories (created_at, event_date, last_verified_at);
```

---

# 8. MCP tools deseadas

## Lectura

```text
search_memories
search_memories_compact
get_memories
recent_memories
memory_stats
memory_timeline
```

## Escritura

```text
save_memory
update_memory
deprecate_memory
verify_memory
save_session_summary
```

## Inteligencia

```text
reflect_memories
detect_contradictions
consolidate_memories
suggest_deprecations
auto_classify_memory
extract_entities
```

## Administración

```text
list_memory_banks
promote_memory
review_memory
archive_memory
```

---

# 9. HTTP API deseada

```text
GET    /health
GET    /stats
POST   /query
POST   /query/compact
GET    /memories/:id
POST   /memories
PATCH  /memories/:id
POST   /memories/:id/deprecate
POST   /memories/:id/verify
POST   /memories/:id/promote
POST   /reflect
POST   /timeline
POST   /session-summary
POST   /events/session-start
POST   /events/user-prompt
POST   /events/post-tool-use
POST   /events/session-end
```

---

# 10. Roadmap recomendado

## v1.6 — Instalación y Docker

```text
- Publicar paquete npm @cabupy/vector-memory-pg.
- Agregar bin global vector-memory.
- Agregar npx install.
- Agregar vector-memory quickstart.
- Agregar docker-compose completo.
- Agregar vector-memory doctor mejorado.
- Agregar vector-memory mcp-config.
```

## v1.7 — Worker y hooks

```text
- Agregar vector-memory worker.
- Agregar endpoints de eventos.
- Agregar SessionStart.
- Agregar UserPromptSubmit.
- Agregar PostToolUse.
- Agregar SessionEnd.
- Agregar save_session_summary.
- Agregar context injection configurable.
```

## v1.8 — Progressive disclosure y timeline

```text
- Agregar search_memories_compact.
- Agregar get_memories por ID.
- Agregar memory_timeline.
- Agregar public_id tipo VM-000001.
- Agregar citaciones de memoria.
- Agregar token budget.
```

## v1.9 — Reflexión y memoria inteligente

```text
- Agregar reflect_memories.
- Agregar detect_contradictions.
- Agregar consolidate_memories.
- Agregar suggest_deprecations.
- Agregar auto_classify.
- Agregar entities.
- Agregar relationships.
```

## v2.0 — UI y gobernanza

```text
- Agregar web viewer local.
- Buscar/filtrar memorias.
- Editar memoria.
- Verificar memoria.
- Deprecar memoria.
- Promover agent_observation a official.
- Ver timeline.
- Ver contradicciones.
- Dashboard por repo/proyecto/memory_bank.
```

## v2.1 — Clientes y ecosistema

```text
- JS/TS client.
- Python client.
- Cookbook.
- Integraciones con Claude Code.
- Integraciones con OpenCode.
- Integraciones con OpenClaw.
- Integraciones con Cursor.
- Benchmark técnico propio.
```

---

# 11. Prioridades absolutas

Si hay que empezar por lo más importante, este sería el orden:

```text
1. npx @cabupy/vector-memory-pg install / vector-memory quickstart
2. Docker Compose completo
3. vector-memory worker
4. Hooks SessionStart / PostToolUse / SessionEnd
5. Context injection configurable
6. Progressive disclosure:
   - search_memories_compact
   - get_memories
   - memory_timeline
7. public_id y citaciones tipo VM-000001
8. memory_bank
9. reflect_memories
10. auto_classify + entities + relationships
11. UI local
12. JS/TS client + Python client
```

---

# 12. Principios de diseño

## 12.1 No convertir todo en memoria oficial

Todo lo capturado automáticamente debe entrar como:

```text
agent_observation
```

o:

```text
temporary
```

Solo debe ser `official` si:

```text
- lo confirma un humano;
- lo promueve una herramienta explícita;
- pasa un flujo de revisión.
```

## 12.2 No guardar secretos

Antes de guardar, vectorizar, clasificar o resumir:

```text
- aplicar denylist;
- aplicar detector de secretos;
- aplicar block/redact;
- respetar <private>;
- respetar @no-memory.
```

## 12.3 No saturar el contexto

Usar progressive disclosure y token budget.

Primero devolver memoria compacta.

Luego expandir solo por IDs.

## 12.4 Preferir memoria vigente y verificada

El ranking debe priorizar:

```text
- status active;
- verified;
- high/critical;
- same repo;
- same memory_bank;
- recent last_verified_at.
```

## 12.5 Mantener foco

No intentar ser memoria general para cualquier agente.

El foco debe ser:

```text
memoria técnica institucional para agentes IA de desarrollo
```

---

# 13. Descripción final sugerida del producto

```text
vector_memory_pg is an institutional semantic memory layer for AI coding agents.

It stores, searches, verifies, and evolves technical memory across repositories: architecture decisions, security rules, known bugs, conventions, business rules, and session learnings.

Built on PostgreSQL + pgvector + Full-Text Search, with HTTP API, MCP server, CLI, and agent workflow support.
```

Versión corta:

```text
Persistent institutional memory for AI coding agents — PostgreSQL + pgvector + MCP.
```

---

# 14. Resultado esperado

Después de implementar estas mejoras, `vector_memory_pg` debería permitir este flujo:

```text
1. El developer instala con npx.
2. El quickstart levanta PostgreSQL + pgvector.
3. El repo se inicializa automáticamente.
4. El agente inicia sesión.
5. SessionStart busca memorias críticas del repo.
6. El agente recibe contexto técnico relevante.
7. Durante la sesión se capturan observaciones.
8. Al terminar, se genera resumen.
9. Las observaciones quedan como candidatas.
10. El humano o el sistema las revisa.
11. Algunas se verifican o se promueven a oficiales.
12. Las memorias viejas se deprecian.
13. El agente futuro ya no empieza de cero.
```

Ese es el salto de:

```text
buscador vectorial de memorias
```

a:

```text
memoria técnica viva para agentes IA de desarrollo
```

```
```
