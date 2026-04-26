# Reflect

`reflect_memories` analiza el conjunto de memorias activas y detecta:

- **Contradicciones**: memorias que se contradicen entre sí.
- **Duplicados**: memorias con contenido muy similar.
- **Gaps**: áreas de conocimiento importantes que faltan documentar.

La herramienta **solo sugiere** — nunca modifica nada. Es el punto de partida para
una sesión de mantenimiento de la base de conocimiento.

## Desde la CLI

```bash
vector-memory iterate
```

Ejecuta reflect, muestra los hallazgos en la terminal y propone acciones concretas
(qué deprecar, qué consolidar, qué agregar).

## Desde MCP

```javascript
// Llamada a la herramienta MCP
reflect_memories({ limit: 20, project: "mi-proyecto" })
```

Retorna:
```json
{
  "analyzed_count": 45,
  "summary": "Base en buen estado con 3 áreas de mejora.",
  "findings": [...],
  "suggested_new_memories": [...],
  "suggested_deprecations": [...]
}
```

## Desde la UI web

En `http://localhost:3010/ui` → pestaña **Reflect**:

- Botón **Ejecutar Reflect** lanza el análisis.
- Cada sugerencia tiene botones **Deprecar** y **Guardar** para actuar directamente.

## Desde HTTP

```bash
POST http://localhost:3010/reflect
Content-Type: application/json

{ "limit": 20, "project": "mi-proyecto" }
```

## Modelo usado

gpt-4o-mini con temperatura 0.1 para análisis consistente y determinista.
El análisis incluye el contenido completo de las memorias más recientes y relevantes.

## Cuándo ejecutar

- Al final de una sesión larga con muchos cambios de criterio.
- Periódicamente (semanal/mensual) para mantener la base limpia.
- Antes de incorporar a un nuevo miembro al equipo.
- Cuando la búsqueda empieza a devolver resultados inconsistentes.
