````md
# Mejoras recomendadas para `vector_memory_pg`

## Visión general

`vector_memory_pg` ya cumple el rol central de una **memoria persistente para agentes IA**, similar en concepto a Engram, pero con una orientación más empresarial:

```text
Agente IA / Claude Code / OpenCode / Cursor
        ↓
      MCP / HTTP API
        ↓
 vector_memory_pg
        ↓
 PostgreSQL + pgvector
````

La diferencia estratégica es que, al usar PostgreSQL + pgvector + HTTP API + MCP, puede evolucionar hacia una **memoria técnica institucional para desarrollo asistido por IA**, no solo una memoria local por developer.

---

# 1. Namespace explícito por empresa / proyecto / repo

Estado: completado para MVP. Ya se agregaron al schema los campos `organization`, `project` y `repo_name`, con índice compuesto para namespace. También se conectaron con ingesta, HTTP API y MCP.

Actualmente se puede inferir parte del contexto desde `source_path`, `source_type` o `session_key`, pero para escalar a muchos proyectos conviene agregar campos explícitos.

## Campos sugeridos

```sql
organization
project
repo_name
branch
environment
owner
```

## Ejemplo de uso

```text
ACME / identity-service
ACME / notification-service
ACME / api-service
ExampleCorp / geo-api
ExampleCorp / web-app
```

## Por qué es importante

Esto permite separar claramente las memorias por empresa, proyecto y repo, evitando depender solamente de rutas de archivo o nombres de sesión.

También facilita preguntas como:

```text
¿Qué reglas de seguridad aplican al identity-service?
¿Qué decisiones técnicas existen para api-service?
¿Qué memorias pertenecen a geo-api?
```

---

# 2. Tipos de memoria más expresivos

Estado: completado para MVP. Ya se agregó el campo `memory_type` al schema con valor por defecto `memory` e índice dedicado. También se conectó con ingesta, HTTP API y MCP.

Actualmente existen tipos generales como:

```text
session
daily
memory
docs
```

Eso está bien para un MVP, pero para desarrollo asistido por IA conviene clasificar mejor la memoria.

## Tipos sugeridos

```text
architecture
security
bug
decision
convention
command
domain
integration
deployment
qa
deprecated
```

## Ejemplos

```text
architecture:
El servicio identity-service centraliza la emisión y validación de JWT.

security:
Todos los endpoints públicos deben tener rate limit y auditoría.

bug:
El servicio notification-service fallaba cuando SES devolvía throttling sin retry controlado.

decision:
Se decidió usar PostgreSQL + pgvector para memoria institucional.

command:
Para correr tests de integración usar npm run test:integration.

integration:
payment-gateway se comunica por VPN y requiere trazabilidad por transaction_id.
```

## Por qué es importante

No es lo mismo recuperar una memoria de arquitectura que una memoria de bug o una regla de seguridad.
La clasificación ayuda al agente a interpretar mejor el contexto antes de modificar código.

---

# 3. Herramientas MCP para escribir memoria

Estado: en progreso. Ya se agregaron `save_memory` y `deprecate_memory` al MCP. Queda pendiente `update_memory`.

Actualmente el MCP expone principalmente herramientas de consulta, recientes y estadísticas.

Para convertirlo en una memoria viva, el agente debería poder escribir, actualizar y deprecar memorias.

## Herramientas MCP sugeridas

```text
save_memory
update_memory
deprecate_memory
```

## Ejemplo de `save_memory`

```text
save_memory:
En identity-service todos los endpoints públicos deben tener rate limit y auditoría.
```

## Ejemplo de `update_memory`

```text
update_memory:
La integración con payment-gateway ya no usa solo batch; se está migrando a operación online.
```

## Ejemplo de `deprecate_memory`

```text
deprecate_memory:
La memoria que indica usar Node 14 queda deprecada. El estándar actual es Node 20+.
```

## Por qué es importante

Sin escritura vía MCP, el sistema depende demasiado de la ingesta de archivos.
Con escritura controlada, el agente puede guardar aprendizajes relevantes al terminar una tarea.

Esto convierte el sistema en una memoria operativa real para agentes.

---

# 4. Control de obsolescencia y vigencia

Estado: completado para MVP. Ya se agregó el campo `status` al schema con valor por defecto `active` e índice dedicado. También se conectó con ingesta, HTTP API y MCP.

Una memoria vieja puede ser peligrosa.
El agente podría recuperar una decisión antigua y aplicarla como si siguiera vigente.

## Campos sugeridos

```sql
status
valid_from
valid_until
superseded_by
confidence
last_verified_at
```

## Valores posibles para `status`

```text
active
deprecated
superseded
archived
```

## Ejemplo

```text
Memoria vieja:
El proyecto usa Node 14.

Estado:
deprecated

Nueva memoria:
El estándar actual del proyecto es Node 20+.
```

## Por qué es importante

Permite distinguir entre:

```text
- memorias vigentes
- memorias reemplazadas
- memorias obsoletas
- memorias que requieren revisión
```

Esto es clave en proyectos de largo plazo, especialmente con múltiples repos y decisiones técnicas que cambian con el tiempo.

---

# 5. Seguridad antes de indexar

Estado: en progreso. Ya se agregó una denylist de paths sensibles antes de indexar, aplicada en `ingest-one` y en `POST /ingest`. Quedan pendientes detector de secretos por contenido, redacción automática, dry-run y logs de sanitización.

Como el sistema puede leer sesiones JSONL, documentos, archivos `.md` y memorias técnicas, es fundamental evitar guardar secretos.

## Detectores sugeridos

```text
API keys
JWT
passwords
private keys
tokens
URLs sensibles de producción
credenciales de proveedores
connection strings
access keys
secret keys
```

## Mejoras sugeridas

```text
redacción automática
allowlist de paths
denylist de paths
política de exclusión de secretos
logs de sanitización
modo dry-run antes de ingerir
```

## Ejemplos de paths a excluir

```text
.env
.env.local
.env.production
*.pem
*.key
id_rsa
id_ed25519
config/secrets.*
credentials.json
service-account.json
```

## Por qué es importante

En repos fintech o de infraestructura real, las sesiones de agentes pueden contener información sensible:

```text
- endpoints internos
- tokens
- rutas privadas
- claves temporales
- usuarios de base de datos
- credenciales de terceros
```

Antes de vectorizar y guardar, conviene sanitizar.

---

# 6. Búsqueda híbrida: vectorial + full-text

La búsqueda vectorial es muy buena para recuperar contexto semántico, pero en desarrollo muchas veces se necesitan coincidencias exactas.

## Ejemplos de términos donde conviene búsqueda exacta

```text
JWT
payment-gateway
banking-network
Express 5
NFD
demo-project
PostGIS
rate limit
SES
Twilio
Meta API
Docker
GitHub Actions
```

## Recomendación

Combinar:

```text
pgvector + PostgreSQL Full-Text Search
```

## Beneficio

Esto permite hacer búsquedas más precisas:

```text
- similitud semántica
- coincidencia exacta
- ranking combinado
- búsqueda por tags
- búsqueda por repo/proyecto/tipo de memoria
```

## Ejemplo conceptual

```sql
SELECT *
FROM memories
WHERE repo_name = 'identity-service'
ORDER BY
  vector_score DESC,
  text_rank DESC;
```

## Por qué es importante

La memoria para agentes de programación no puede depender solamente de embeddings.
Hay conceptos técnicos que deben matchear de forma literal.

---

# 7. Separar memoria local de memoria institucional

La oportunidad más grande no es copiar Engram, sino diferenciar `vector_memory_pg`.

## Engram local

```text
- notas rápidas de sesión
- aprendizaje personal del dev
- contexto temporal
- memoria en laptop
- uso individual
```

## vector_memory_pg institucional

```text
- decisiones oficiales
- arquitectura aprobada
- estándares de seguridad
- reglas por repo
- documentación técnica indexada
- trazabilidad multi-equipo
- memoria compartida
- auditoría
- gobernanza técnica
```

## Posicionamiento recomendado

```text
vector_memory_pg es una memoria técnica institucional para desarrollo asistido por IA, basada en PostgreSQL + pgvector, accesible por HTTP y MCP, diseñada para centralizar conocimiento técnico de proyectos, sesiones, documentación y decisiones de arquitectura.
```

---

# 8. Diferenciarse de Engram por PostgreSQL y gobernanza

Engram puede ser más liviano y cómodo para uso local.
Pero `vector_memory_pg` puede ser más potente en entornos empresariales.

## Diferenciales de `vector_memory_pg`

```text
PostgreSQL
pgvector
MCP
HTTP API
multi-repo
multi-equipo
centralización
auditoría
backup
permisos
gobernanza técnica
integración con sistemas existentes
```

## Por qué es importante

Para una empresa como ExampleCorp/ACME, no alcanza con que cada developer tenga una memoria local.
El valor está en construir una memoria técnica compartida que pueda sobrevivir a:

```text
- cambios de equipo
- rotación de developers
- múltiples repos
- múltiples agentes
- decisiones históricas
- auditorías internas
- evolución de arquitectura
```

---

# 9. Mejorar experiencia de producto / CLI / UX

Para que los developers realmente lo usen, tiene que ser simple.

## Mejoras sugeridas

```text
CLI más cómoda
detección automática del proyecto
detección automática del git remote
comandos simples de init
comandos de ingest por repo
modo watch
resumen de sesión
recordatorio para guardar memoria
validación de configuración
asistente interactivo
```

## Comandos posibles

```bash
vector-memory init
vector-memory ingest
vector-memory search "rate limit identity-service"
vector-memory recent
vector-memory stats
vector-memory doctor
vector-memory watch
```

## Detección automática sugerida

El sistema podría detectar:

```text
git remote
nombre del repo
branch actual
package.json
framework
lenguaje
scripts de test
README
AGENTS.md
docs/
```

## Por qué es importante

La adopción interna depende de fricción baja.
Si el developer tiene que configurar demasiado, probablemente no lo use.

---

# 10. Corregir inconsistencia documental del README

Estado: completado. El README ya está alineado con `text-embedding-3-small`, `1536` dimensiones y `vector(1536)`. También se corrigieron referencias internas en `src/db.js` y `src/setup-db.js`.

Hay una inconsistencia en la documentación:

En una parte se menciona `text-embedding-3-small` con **1536 dimensiones**, pero en el diagrama aparece:

```text
vector(768)
```

Sin embargo, el schema real usa:

```sql
embedding vector(1536)
```

## Recomendación

Corregir todo el README para que sea consistente con:

```text
text-embedding-3-small → 1536 dimensiones → vector(1536)
```

## Por qué es importante

La documentación debe transmitir confianza.
Una inconsistencia entre README y schema puede hacer pensar que el proyecto está desalineado o incompleto, aunque el código esté bien.

---

# 11. Agregar metadata de fuente, autor, criticidad y tags

Estado: en progreso. Ya se agregaron al schema los campos `criticality` y `tags`, con índices dedicados, y se conectaron con ingesta, HTTP API y MCP. Quedan pendientes campos como `author`, `created_by_agent`, `source_commit`, `module`, `updated_at` y `last_accessed_at`.

Además de `source_type`, `source_path` y `metadata`, conviene enriquecer la memoria con campos más explícitos.

## Campos sugeridos

```text
source
source_path
source_commit
author
created_by_agent
criticality
tags
module
service_name
created_at
updated_at
last_accessed_at
```

## Ejemplo

```json
{
  "organization": "ACME",
  "project": "demo-project",
  "repo_name": "api-service",
  "module": "credit-decision",
  "memory_type": "decision",
  "criticality": "high",
  "tags": ["credit", "bureau", "risk-engine", "llm"],
  "created_by_agent": false,
  "author": "Carlos"
}
```

## Por qué es importante

Permite responder preguntas como:

```text
¿Qué reglas críticas de seguridad tiene identity-service?
¿Qué decisiones de arquitectura existen para notification-service?
¿Qué memorias fueron generadas por un agente y cuáles por humanos?
¿Qué memorias de alta criticidad existen en demo-project?
```

---

# 12. Integración futura con GitHub / Jira / Confluence / ADR

El enfoque puede crecer naturalmente hacia una memoria técnica más amplia.

## Fuentes posibles

```text
README.md
AGENTS.md
issues de GitHub
pull requests
Jira tickets
Confluence docs
ADR
documentación de APIs
OpenAPI specs
diagramas técnicos
runbooks
postmortems
```

## Ejemplos de uso

```text
- Buscar decisiones tomadas en PRs antiguos.
- Relacionar bugs recurrentes con issues de Jira.
- Consultar ADRs desde Claude Code.
- Recuperar documentación de APIs internas.
- Encontrar reglas técnicas antes de implementar una feature.
```

## Por qué es importante

Esto convertiría `vector_memory_pg` en un índice semántico del conocimiento técnico de la empresa.

No sería solamente memoria de sesiones IA, sino una capa de conocimiento institucional.

---

# 13. Política de memorias oficiales vs memorias generadas por agentes

Es importante distinguir quién creó la memoria y qué nivel de autoridad tiene.

## Tipos de autoridad sugeridos

```text
official
agent_observation
developer_note
temporary
deprecated
```

## Ejemplo

```text
official:
Todos los endpoints públicos deben tener rate limit.

agent_observation:
El agente detectó que algunos controladores antiguos no usan middleware de rate limit.

developer_note:
Revisar si este comportamiento sigue vigente después de la migración a Express 5.
```

## Por qué es importante

No toda memoria debe tener el mismo peso.
Una observación automática del agente no debería tener la misma autoridad que una decisión aprobada por arquitectura.

---

# 14. Scoring y ranking más inteligente

Además de similitud vectorial, el ranking podría considerar más factores.

## Factores sugeridos

```text
similarity_score
text_rank
memory_type
criticality
recency
status
project_match
repo_match
tag_match
last_verified_at
```

## Ejemplo conceptual

Una memoria debería rankear más alto si:

```text
- pertenece al mismo repo
- está activa
- es de alta criticidad
- fue verificada recientemente
- coincide por vector y por keyword
- tiene tags relevantes
```

## Por qué es importante

En una base grande, traer “lo más parecido” no siempre es traer “lo más correcto”.

---

# 15. Validación antes de usar memoria crítica

Para memorias críticas, el agente debería ser más cuidadoso.

## Ejemplo

Si una memoria es de tipo:

```text
security
architecture
deployment
integration
```

Y además tiene criticidad alta, el agente podría responder:

```text
Encontré una memoria crítica vigente sobre este repo. La voy a usar como restricción antes de proponer cambios.
```

## Por qué es importante

Ayuda a que los agentes respeten reglas fuertes antes de modificar código sensible.

---

# 16. Soporte para `AGENTS.md` por repo

Sería muy útil que cada repo tenga un archivo `AGENTS.md` con reglas propias.

## Ejemplo

```md
# AGENTS.md

## Reglas del repo

- Usar Node 20+.
- No interpolar SQL.
- Todos los endpoints públicos deben tener rate limit.
- No modificar migraciones ya aplicadas.
- Correr npm run lint antes de proponer PR.
- Correr npm run test:integration para cambios en servicios críticos.
```

## Uso con `vector_memory_pg`

El sistema podría ingerir automáticamente:

```text
AGENTS.md
README.md
docs/
adr/
```

## Por qué es importante

`AGENTS.md` puede funcionar como contrato local entre el repo y los agentes.

---

# 17. Modo “project bootstrap”

Un comando útil sería inicializar memoria de un repo automáticamente.

## Comando sugerido

```bash
vector-memory init-project
```

## Qué podría hacer

```text
1. Detectar git remote.
2. Detectar nombre del repo.
3. Detectar stack.
4. Leer README.md.
5. Leer package.json.
6. Leer AGENTS.md si existe.
7. Leer docs relevantes.
8. Registrar metadata del proyecto.
9. Crear namespace inicial.
10. Sugerir memorias iniciales.
```

## Por qué es importante

Permite adoptar la herramienta repo por repo sin esfuerzo manual excesivo.

---

# 18. Modo “session summary”

Después de una sesión larga de trabajo con un agente, conviene guardar resumen.

## Ejemplo

```text
Durante esta sesión se modificó el flujo de autenticación.
Se detectó que los endpoints públicos no tenían rate limit uniforme.
Se agregó middleware global.
Pendiente: revisar tests de integración.
```

## Herramienta posible

```text
save_session_summary
```

## Por qué es importante

Las sesiones de agentes suelen contener mucho ruido.
Un resumen estructurado puede ser más valioso que indexar todo el JSONL completo.

---

# 19. Limpieza y compactación de memoria

Con el tiempo, la memoria puede crecer demasiado.

## Mejoras sugeridas

```text
deduplicación de chunks
compactación de memorias similares
archivo de memorias antiguas
detección de memorias contradictorias
detección de memorias duplicadas
```

## Ejemplo

Si existen tres memorias parecidas:

```text
Usamos Node 18.
El proyecto corre en Node 20.
Actualizar a Node 20+.
```

El sistema debería poder sugerir consolidación:

```text
Memoria consolidada:
El estándar actual del proyecto es Node 20+.
```

## Por qué es importante

Una memoria desordenada puede degradar la calidad de las respuestas del agente.

---

# 20. Métricas de uso

Para evaluar adopción y utilidad, conviene medir.

## Métricas sugeridas

```text
cantidad de memorias por proyecto
memorias consultadas por día
queries más frecuentes
memorias más recuperadas
memorias obsoletas
memorias sin verificar
memorias críticas
tiempo desde última ingesta
cantidad de memorias por tipo
```

## Por qué es importante

Permite saber si la herramienta realmente se usa y dónde aporta valor.

---

# 21. Administración simple

Si esto se usa en equipo, sería útil tener una mínima consola o endpoints administrativos.

## Funciones sugeridas

```text
listar memorias
editar memoria
deprecar memoria
marcar como oficial
ver memorias por repo
ver memorias críticas
ver memorias sin verificar
buscar duplicados
```

## Por qué es importante

Una memoria institucional necesita gobierno.
No todo debería quedar librado al agente.

---

# 22. Permisos y visibilidad

Si escala a varios equipos, no todas las memorias deberían ser visibles para todos.

## Modelo sugerido

```text
organization
project
repo
team
role
visibility
```

## Valores posibles de `visibility`

```text
public
internal
restricted
private
```

## Por qué es importante

Algunas memorias pueden contener contexto sensible de clientes, integraciones o infraestructura.

---

# 23. Roadmap sugerido

## Fase 1 — Ordenar base actual

```text
- [x] Corregir README vector(768) vs vector(1536).
- [x] Agregar namespace básico: organization, project, repo_name en schema.
- [x] Agregar memory_type más expresivo en schema.
- [x] Agregar status: active/deprecated/superseded en schema.
- [x] Conectar namespace, memory_type y status con ingesta/API/MCP.
```

## Fase 2 — Convertirlo en memoria viva

```text
- [x] Agregar MCP save_memory.
- Agregar MCP update_memory.
- [x] Agregar MCP deprecate_memory.
- Agregar last_verified_at.
- [x] Agregar criticality y tags en schema.
- [x] Conectar criticality y tags con ingesta/API/MCP.
```

## Fase 3 — Seguridad

```text
- [ ] Detector de secretos.
- [ ] Redacción automática.
- [x] Denylist de paths.
- Dry-run de ingesta.
- Logs de sanitización.
```

## Fase 4 — Mejor búsqueda

```text
- Full-text search en PostgreSQL.
- Ranking híbrido vector + keyword.
- Filtros por repo/proyecto/tipo/status.
- Scoring por criticidad y vigencia.
```

## Fase 5 — UX para developers

```text
- CLI init-project.
- CLI doctor.
- CLI ingest.
- CLI search.
- Auto-detección de git remote.
- Ingesta automática de README.md / AGENTS.md / docs.
```

## Fase 6 — Gobierno institucional

```text
- Administración de memorias.
- Marcar memorias como oficiales.
- Detectar duplicados.
- Detectar contradicciones.
- Métricas de uso.
- Permisos por proyecto/equipo.
```

---

# Resumen ejecutivo

`vector_memory_pg` ya resuelve el núcleo técnico:

```text
- PostgreSQL + pgvector
- embeddings
- búsqueda semántica
- HTTP API
- MCP server
- ingesta de memorias/documentos/sesiones
```

El siguiente salto no es copiar Engram, sino convertirlo en una herramienta más fuerte:

```text
Memoria técnica institucional para desarrollo asistido por IA.
```

Las mejoras más importantes son:

```text
1. Namespace empresa/proyecto/repo.
2. Tipos de memoria más útiles.
3. MCP para guardar/actualizar/deprecar memoria.
4. Control de vigencia y obsolescencia.
5. Sanitización de secretos.
6. Búsqueda híbrida vector + full-text.
7. Metadata de autor, criticidad, tags y fuente.
8. UX/CLI más simple para developers.
9. Soporte para AGENTS.md.
10. Integración futura con GitHub/Jira/Confluence/ADR.
```

La mejora más importante de todas:

```text
Agregar MCP de escritura + control de vigencia.
```

Porque ahí deja de ser solamente un buscador vectorial y se convierte en una memoria viva, gobernable y útil para agentes IA trabajando sobre proyectos reales.

```
```
