# Integración con Claude Code

## Instalación rápida

```bash
vector-memory init --tools claude-code
```

Esto ejecuta en un solo paso:
1. Crea `.vector-memory.json` con la config del repo
2. Escribe las instrucciones de uso en `CLAUDE.md`
3. Instala 5 slash commands en `.claude/commands/`
4. Muestra el snippet de config MCP

## Instalación manual

### Skills (instrucciones de uso)

```bash
vector-memory skills install --target claude-code
```

Escribe un bloque marcado con `<!-- vector-memory-skill -->` en `CLAUDE.md`.
Si el archivo ya tiene el marker, la operación es idempotente.

### Slash commands

```bash
vector-memory commands install --target claude-code
```

Crea los archivos en `.claude/commands/`:

| Comando | Descripción |
|---|---|
| `/vm-context` | Carga contexto relevante al inicio de sesión |
| `/vm-search` | Busca memorias por query semántica |
| `/vm-save` | Guarda un fragmento de conocimiento |
| `/vm-reflect` | Ejecuta reflect y muestra hallazgos |
| `/vm-iterate` | Itera sobre memorias y sugiere mejoras |

### Config MCP

```bash
vector-memory mcp-config --target claude-code
```

Agrega el servidor MCP al `~/.claude/mcp.json` o muestra el snippet para copiarlo.

## Flujo recomendado

Al inicio de cada sesión Claude Code cargará el contexto via `CLAUDE.md`.
Las instrucciones le indican llamar `search_memories_compact` con el tema de la tarea
y `recent_memories` para ver el trabajo reciente.

Al final de sesión debe llamar `save_session_summary`.

## Verificar instalación

```bash
vector-memory doctor
```

Muestra si `CLAUDE.md`, los commands y la conexión MCP están configurados correctamente.
