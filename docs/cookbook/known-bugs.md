# Cookbook: Bugs Conocidos

Documenta bugs no obvios, workarounds y restricciones para que los agentes
no repitan los mismos errores.

## Qué guardar

- Bugs con workarounds no intuitivos.
- Comportamientos inesperados de dependencias.
- Errores que tardaron horas en diagnosticar.
- Restricciones del entorno (versiones, configuraciones, límites).

## Ejemplo

```javascript
save_memory({
  content: `La columna search_vector en la tabla memories se genera automáticamente
    (GENERATED ALWAYS AS). Incluirla en un INSERT explícito causa error:
    "ERROR: column search_vector is a generated column".
    Solución: nunca listar search_vector en el INSERT; se genera sola.`,
  memory_type: "bug",
  criticality: "high",
  tags: ["postgresql", "search_vector", "generated-column", "insert"],
  project: "vector-memory"
})
```

## Template sugerido

```
Bug: [descripción del problema]
Síntoma: [qué se ve cuando ocurre]
Causa raíz: [por qué ocurre]
Workaround: [cómo evitarlo o solucionarlo]
Aplica a: [versión/entorno/condición]
```

## Bugs vs Constraints

- **`bug`**: comportamiento incorrecto con workaround conocido.
- **`constraint`**: limitación del sistema que no tiene solución (solo hay que conocerla).

Ejemplo de constraint:
```javascript
save_memory({
  content: "pgvector solo soporta hasta 2000 dimensiones por vector en la versión actual.",
  memory_type: "constraint",
  criticality: "normal",
  tags: ["pgvector", "dimensiones", "límite"]
})
```
