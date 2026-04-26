# Contribuir a vector_memory_pg

Gracias por tu interes en contribuir.

Repositorio: [github.com/cabupy/vector_memory_pg](https://github.com/cabupy/vector_memory_pg)

Este proyecto acepta contribuciones de bugs, features, documentacion, seguridad, testing, ideas de arquitectura y mejoras de DX/CLI.

## Antes De Empezar

- Revisa el [README.md](./README.md).
- Revisa el roadmap público en [ROADMAP.md](./ROADMAP.md).
- Abre un issue antes de implementar cambios grandes.
- No incluyas secretos, `.env`, llaves privadas ni credenciales en issues, commits o PRs.

## Reportar Bugs

Abre un issue en:

```text
https://github.com/cabupy/vector_memory_pg/issues
```

Incluye:

- Version de Node.js.
- Version de PostgreSQL.
- Version de pgvector: `SELECT extversion FROM pg_extension WHERE extname = 'vector';`
- Sistema operativo.
- Pasos para reproducir.
- Logs relevantes.
- Resultado esperado y resultado actual.

## Proponer Features

Abre un issue antes de escribir codigo si la feature cambia schema, API, MCP tools, ranking, seguridad o comportamiento de ingesta.

Buenas areas para contribuir:

- detector de secretos por contenido
- redaccion automatica
- dry-run de ingesta
- CLI/doctor/init-project/onboarding de agentes
- tests automatizados
- mejoras de ranking
- administracion de memorias
- deteccion de duplicados o contradicciones
- ejemplos/cookbook y demos de adopcion

## Pull Requests

1. Forkea el repo.
2. Crea una rama desde `main`:

```bash
git checkout -b feature/mi-feature
```

3. Haz cambios pequenos y enfocados.
4. Verifica sintaxis en archivos JS modificados:

```bash
node --check src/archivo.js
```

5. Si el cambio toca schema o runtime, prueba cuando aplique:

```bash
npm run setup
npm run server
npm run mcp
```

6. Actualiza README, CONTRIBUTING, ROADMAP o docs si cambia comportamiento publico.
7. Abre el PR contra `main` con una descripcion clara.

## Estilo De Codigo

- ES Modules (`import/export`).
- Node.js 22+.
- Mantener dependencias al minimo.
- No agregar dependencias nuevas sin explicar el motivo en el issue/PR.
- Preferir cambios pequenos y faciles de revisar.
- Mantener SQL idempotente cuando sea migracion de schema.
- No romper compatibilidad de endpoints o herramientas MCP sin documentarlo.

## Seguridad

No subas ni pegues:

- `.env`
- API keys
- tokens
- JWTs reales
- llaves privadas
- connection strings reales
- credenciales de proveedores
- dumps de sesiones con secretos

Si encuentras un problema de seguridad, abre un issue sin incluir secretos reales o contacta al maintainer via GitHub: [@cabupy](https://github.com/cabupy).

## Commits

Usa mensajes claros y cortos. Ejemplos:

```text
feat: agregar detector de secretos
fix: corregir ranking por status
docs: actualizar ejemplos mcp
```

## Licencia

Al contribuir aceptas que tus cambios se publiquen bajo la licencia MIT del proyecto.
