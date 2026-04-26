# Cookbook: Resúmenes de Sesión

Los resúmenes de sesión son memorias de tipo `session_summary` que capturan
el trabajo realizado, las decisiones tomadas y lo que quedó pendiente.

## Por qué son importantes

- Permiten retomar el contexto exacto en la próxima sesión.
- Sirven como bitácora de decisiones para el equipo.
- Alimentan `recent_memories` y `memory_timeline` para continuidad.
- Son el principal input del comando `iterate` para detectar mejoras.

## Guardar al final de cada sesión

### Via MCP (desde el agente)

```javascript
save_session_summary({
  content: `Trabajé en el módulo de autenticación.

Problemas encontrados:
- JWT expirado no devuelve 401 sino 500 en el middleware de Express.
  Workaround: agregar try/catch en verifyToken().

Decisiones:
- Usar refresh tokens con TTL de 7 días (en lugar de 24h).
- Guardar refresh tokens en Redis, no en la DB.

Pendiente:
- Implementar revocación de tokens.
- Tests de integración para el flujo completo.`,
  project: "mi-proyecto",
  tags: ["autenticación", "jwt", "redis"]
})
```

### Via CLI (manual)

```bash
vector-memory worker  # Iniciar el servidor
# Luego POST /events/session-end desde tu script o curl
```

## Template sugerido

```
Trabajé en [módulo/feature].

Problemas encontrados:
- [descripción + workaround si aplica]

Decisiones:
- [decisión tomada y razón]

Pendiente:
- [qué quedó sin terminar]
- [próximos pasos]
```

## Ver sesiones recientes

```bash
vector-memory search "sesión" --type session_summary
```

O vía MCP:
```javascript
recent_memories({ limit: 5, memory_type: "session_summary" })
```
