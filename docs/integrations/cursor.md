# Integración con Cursor

## Instalación rápida

```bash
vector-memory init --tools cursor
```

Esto ejecuta en un solo paso:
1. Crea `.vector-memory.json` con la config del repo
2. Escribe las instrucciones de uso en `.cursor/rules/vector-memory.mdc`
3. Muestra el snippet de configuración MCP

## Instalación manual

### Instrucciones De Uso (skills)

```bash
vector-memory skills install --target cursor
```

Crea o actualiza `.cursor/rules/vector-memory.mdc` con las instrucciones de uso
de las herramientas MCP. Usa el marcador `<!-- vector-memory-skill -->` para evitar duplicados.

### Configuración MCP

```bash
vector-memory mcp-config --target cursor
```

Muestra el snippet JSON para agregar al `mcp.json` de Cursor.

## Configuración MCP en Cursor

En Cursor, abre **Settings → MCP** y agrega el servidor:

```json
{
  "vector-memory": {
    "command": "npx",
    "args": ["-y", "vector-memory-pg", "mcp"],
    "env": {
      "VECTOR_MEMORY_DATABASE_URL": "YOUR_VECTOR_MEMORY_DATABASE_URL",
      "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
    }
  }
}
```

## Notas

- Cursor no soporta comandos slash propios; las instrucciones se configuran vía Cursor Rules.
- El archivo `.cursor/rules/vector-memory.mdc` se aplica automáticamente a todos los chats del proyecto.
- Verifica que el modelo seleccionado soporte llamadas a herramientas.
