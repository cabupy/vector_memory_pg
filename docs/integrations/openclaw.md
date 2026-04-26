# Integración con OpenClaw

## Instalación rápida

```bash
vector-memory init --tools openclaw
```

Esto ejecuta en un solo paso:
1. Crea `.vector-memory.json` con la config del repo
2. Escribe las instrucciones de uso en `AGENTS.md`
3. Instala 5 comandos slash en `.opencode/commands/` (compartidos con OpenCode)
4. Muestra el snippet de configuración MCP

## Instalación manual

### Instrucciones De Uso (skills)

```bash
vector-memory skills install --target openclaw
```

Escribe un bloque marcado con `<!-- vector-memory-skill -->` en `AGENTS.md`.

### Comandos Slash

```bash
vector-memory commands install --target openclaw
```

OpenClaw comparte el directorio de comandos con OpenCode (`.opencode/commands/`).

### Configuración MCP

```bash
vector-memory mcp-config --target openclaw
```

## Notas

- OpenClaw usa `AGENTS.md` como archivo de instrucciones, igual que Codex y OpenCode.
- El directorio de comandos es `.opencode/commands/` (compatibilidad con OpenCode).
- Si ya instalaste para `opencode`, la instalación para `openclaw` es idempotente.
