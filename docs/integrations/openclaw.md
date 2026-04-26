# Integración con OpenClaw

## Instalación rápida

```bash
vector-memory init --tools openclaw
```

Esto ejecuta en un solo paso:
1. Crea `.vector-memory.json` con la config del repo
2. Escribe las instrucciones de uso en `AGENTS.md`
3. Instala 5 slash commands en `.opencode/commands/` (compartidos con OpenCode)
4. Muestra el snippet de config MCP

## Instalación manual

### Skills (instrucciones de uso)

```bash
vector-memory skills install --target openclaw
```

Escribe un bloque marcado con `<!-- vector-memory-skill -->` en `AGENTS.md`.

### Slash commands

```bash
vector-memory commands install --target openclaw
```

OpenClaw comparte el directorio de commands con OpenCode (`.opencode/commands/`).

### Config MCP

```bash
vector-memory mcp-config --target openclaw
```

## Notas

- OpenClaw usa `AGENTS.md` como archivo de instrucciones, igual que Codex y OpenCode.
- El directorio de commands es `.opencode/commands/` (compatibilidad con OpenCode).
- Si ya instalaste para `opencode`, la instalación para `openclaw` es idempotente.
