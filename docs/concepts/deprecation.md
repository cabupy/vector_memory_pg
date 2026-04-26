# Deprecación de Memorias

Deprecar una memoria la marca como obsoleta sin eliminarla.
El historial se preserva; las memorias deprecadas aparecen con penalización en el ranking.

## Cuándo deprecar

- Una decisión técnica fue revertida o reemplazada.
- Un bug fue corregido y el workaround ya no es necesario.
- Una restricción del sistema ya no existe.
- Una memoria fue consolidada en otra más completa.

## Cómo deprecar

### Desde MCP

```javascript
deprecate_memory({
  id: "mem_abc123",
  reason: "Reemplazada por la decisión en mem_xyz789 (migración a PostgreSQL 18)"
})
```

Siempre incluye `reason` — es el contexto que quedará para entender la historia.

### Desde la UI web

En `http://localhost:3010/ui` → vista de memorias → botón **Deprecar**.

### Desde HTTP

```bash
POST http://localhost:3010/memories/mem_abc123/deprecate
Content-Type: application/json

{ "reason": "Workaround ya no necesario desde v2.3.0" }
```

## Impacto en el ranking

- Memorias `deprecated`: penalización de **-0.25** en el score.
- Memorias `archived`: penalización de **-0.45** en el score.

Esto hace que las memorias obsoletas raramente aparezcan en búsquedas normales,
pero siguen siendo recuperables con el filtro `--status deprecated`.

## Flujo típico: actualizar una memoria

Cuando algo cambia, el flujo recomendado es:

1. `deprecate_memory` sobre la memoria anterior (con `reason` apuntando a la nueva).
2. `save_memory` con el conocimiento actualizado.
3. Opcionalmente: referenciar el `public_id` de la memoria anterior en la nueva.

Esto preserva el historial y mantiene la base limpia para búsquedas futuras.

## Ver memorias deprecadas

```bash
vector-memory search "postgresql" --status deprecated
```

Útil para auditorías o para entender la evolución de una decisión técnica.
