# Cookbook: Decisiones de Arquitectura

Guarda las decisiones de arquitectura como memorias de tipo `decision` para que
los agentes tengan contexto al sugerir cambios técnicos.

## Qué guardar

- Por qué se eligió una tecnología sobre otra.
- Restricciones que motivaron el diseño.
- Trade-offs aceptados conscientemente.
- Decisiones que parecen obvias pero tienen razones no evidentes.

## Ejemplo

```javascript
save_memory({
  content: `Usamos PostgreSQL en lugar de MongoDB porque necesitamos transacciones ACID
    para las operaciones de crédito/débito. El esquema es predecible y no cambia frecuentemente.
    Evaluamos Mongo en 2024-Q1 y lo descartamos por inconsistencias en transacciones multi-doc.`,
  memory_type: "decision",
  criticality: "high",
  tags: ["postgresql", "arquitectura", "base-de-datos"],
  project: "mi-proyecto"
})
```

## Template sugerido

```
Decidimos [qué] en lugar de [alternativa] porque [razones].
Evaluamos [alternativas consideradas] y las descartamos porque [razones].
Esta decisión aplica mientras [condiciones]. Revisar si [trigger de cambio].
```

## Mantenimiento

Cuando una decisión cambia:
1. `deprecate_memory` sobre la memoria anterior con `reason` explicando el cambio.
2. `save_memory` con la nueva decisión, referenciando la anterior.

Así se preserva la historia de por qué se tomó cada camino.
