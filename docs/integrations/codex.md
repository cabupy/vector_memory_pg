# Integración con OpenAI Codex (codex CLI)

## Instalación rápida

```bash
vector-memory init --tools codex
```

Esto ejecuta en un solo paso:
1. Crea `.vector-memory.json` con la config del repo
2. Escribe las instrucciones de uso en `AGENTS.md`
3. Muestra el snippet de config MCP

## Instalación manual

### Skills (instrucciones de uso)

```bash
vector-memory skills install --target codex
```

Escribe un bloque marcado con `<!-- vector-memory-skill -->` en `AGENTS.md`.
Si el archivo ya tiene el marker, la operación es idempotente.

### Config MCP

```bash
vector-memory mcp-config --target codex
```

Muestra el snippet para el bloque `mcpServers` en la config de Codex.

## Configuración MCP

En `~/.codex/config.yaml` o el archivo de config de tu proyecto:

```yaml
mcpServers:
  vector-memory:
    command: npx
    args: ["-y", "vector-memory-pg", "mcp"]
    env:
      VECTOR_MEMORY_DATABASE_URL: "YOUR_VECTOR_MEMORY_DATABASE_URL"
      OPENAI_API_KEY: "YOUR_OPENAI_API_KEY"
```

## Notas

- `AGENTS.md` en la raíz del repo es el archivo de instrucciones estándar para Codex.
- Las instrucciones indican al agente el flujo: `search_memories_compact` al inicio,
  `save_memory` durante la sesión, `save_session_summary` al final.
