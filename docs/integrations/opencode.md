# Integración con OpenCode

## Instalación rápida

```bash
vector-memory init --tools opencode
```

Esto ejecuta en un solo paso:
1. Crea `.vector-memory.json` con la config del repo
2. Escribe las instrucciones de uso en `AGENTS.md`
3. Instala 5 comandos slash en `.opencode/commands/`
4. Muestra el snippet de configuración MCP

## Instalación manual

### Instrucciones De Uso (skills)

```bash
vector-memory skills install --target opencode
```

Escribe un bloque marcado con `<!-- vector-memory-skill -->` en `AGENTS.md`.

### Comandos Slash

```bash
vector-memory commands install --target opencode
```

Crea los archivos en `.opencode/commands/`:

| Comando | Descripción |
|---|---|
| `/vm-context` | Carga contexto relevante al inicio de sesión |
| `/vm-search` | Busca memorias por query semántica |
| `/vm-save` | Guarda un fragmento de conocimiento |
| `/vm-reflect` | Ejecuta reflect y muestra hallazgos |
| `/vm-iterate` | Itera sobre memorias y sugiere mejoras |

### Configuración MCP

```bash
vector-memory mcp-config --target opencode
```

Muestra el snippet para `.opencode/config.json`.

## Configuración MCP en OpenCode

En `.opencode/config.json`:

```json
{
  "mcp": {
    "vector-memory": {
      "command": "npx",
      "args": ["-y", "vector-memory-pg", "mcp"],
      "env": {
        "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
      }
    }
  }
}
```

O a nivel global en `~/.config/opencode/config.json`.

## Notas

- `AGENTS.md` en la raíz del repo es leído automáticamente por OpenCode como prompt de sistema.
- Los comandos slash permiten invocar flujos de memoria directamente desde el chat.
