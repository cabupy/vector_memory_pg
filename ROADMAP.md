# Hoja De Ruta

Esta hoja de ruta resume la dirección pública de `vector-memory-pg`.
Las notas largas de planificación quedaron archivadas en `docs/archive/`.

Versión en inglés: [ROADMAP.en.md](./ROADMAP.en.md)

---

## Ya Implementado

- Almacenamiento en PostgreSQL + pgvector con búsqueda vectorial HNSW.
- Ranking híbrido: similitud vectorial, búsqueda de texto completo, criticidad y verificación.
- Servidor MCP con 12 herramientas para búsqueda, recuperación, escritura, verificación, deprecación, cronología, estadísticas y reflect.
- HTTP API y UI web local en `http://localhost:3010/ui`.
- Flujo Reflect para contradicciones, duplicados, vacíos de conocimiento y memorias sugeridas.
- Instalación priorizando Docker con `vector-memory up` y `vector-memory migrate`.
- Config global vía `~/.vector-memory.env` y `VECTOR_MEMORY_DATABASE_URL` dedicada.
- Onboarding multi-agente con `vector-memory init --tools`.
- `skills install` para Claude Code, Cursor, Codex, OpenCode y OpenClaw.
- Comandos slash para Claude Code, OpenCode y OpenClaw.
- Bancos de memoria vía comandos `bank`, `doc` y `manifest`.
- Recetario con guías para decisiones de arquitectura, bugs conocidos, reglas de seguridad y resúmenes de sesión.

---

## Próximo

- Agregar capturas o un GIF corto de la UI local.
- Agregar una demo de punta a punta: un agente recuerda una decisión y evita repetir un error conocido.
- Expandir ejemplos del recetario para flujos reales con agentes.
- Mejorar ejemplos para contribuidores sobre MCP, HTTP API y flujos CLI.
- Agregar pruebas de humo livianas para comandos críticos del CLI.

---

## En Exploración

- App de escritorio / app de barra de menú encima del CLI + worker existente.
- Gobernanza de memorias oficiales: cola de revisión, aprobación y niveles de autoridad.
- Extracción de entidades y relaciones para mejorar la recuperación.
- Benchmarks de calidad de recuperación y fuga de memorias deprecated.
- Exportación/importación en JSONL o Markdown para backups.

---

## Más Adelante

- Ingesta desde GitHub, Jira, Confluence y ADRs.
- Permisos y visibilidad por organización, proyecto, equipo o rol.
- Clientes oficiales JS/TS y Python si crece el uso desde aplicaciones externas.
- Plantillas opcionales para despliegues hospedados o compartidos.

---

## No Objetivos Por Ahora

- Reemplazar PostgreSQL por un almacenamiento exclusivamente local.
- Hacer que la app desktop sea requerida para usar CLI o MCP.
- Agregar dependencias pesadas al paquete npm base sin un beneficio claro de adopción.

---

## Notas Históricas

Documentos antiguos de planificación preservados como referencia:

- `docs/archive/mejoras.md`
- `docs/archive/mejoras-2.md`
