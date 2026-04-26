# Verificación de Memorias

La verificación confirma que una memoria sigue siendo válida y actualizada.
Las memorias verificadas recientemente reciben un boost en el ranking de búsqueda.

## Por qué verificar

Con el tiempo, el conocimiento técnico puede quedar desactualizado:
- Una dependencia cambia de versión y el workaround ya no aplica.
- Una decisión de arquitectura fue revertida.
- Un bug fue corregido en el framework.

Verificar una memoria indica explícitamente "esta información sigue siendo correcta a día de hoy".

## Cómo verificar

### Desde MCP

```javascript
verify_memory({ id: "mem_abc123" })
```

Actualiza el campo `verified_at` con la fecha actual.

### Desde la UI web

En `http://localhost:3010/ui` → vista de memorias → botón **Verificar**.

## Impacto en el ranking

El sistema de búsqueda híbrida incluye un boost por verificación reciente:

- Memorias verificadas en los últimos 30 días: **+0.08** en el score final.
- Memorias sin verificar o verificadas hace más de 30 días: sin boost.

## Estrategia recomendada

No es necesario verificar todas las memorias. Prioriza:

1. Memorias con `criticality: critical` o `high`.
2. Memorias de tipo `constraint` (restricciones del sistema).
3. Memorias que aparecen frecuentemente en búsquedas.
4. Memorias de más de 3 meses sin verificar.

```bash
# Ver memorias sin verificar recientemente
vector-memory search "arquitectura" --status active
```

Luego usa `verify_memory` vía MCP o la UI para confirmar las que siguen vigentes.
