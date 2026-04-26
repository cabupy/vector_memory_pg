# Desktop Roadmap

Ideas y funcionalidades candidatas para una futura versión desktop/GUI de vector-memory.
Este documento es especulativo — nada aquí está comprometido ni tiene fecha.

---

## Motivación

La UI web actual (`http://localhost:3010/ui`) cubre los casos de uso básicos,
pero una app desktop nativa podría ofrecer:

- Inicio automático en segundo plano (sin `vector-memory worker`).
- Acceso desde la barra de menú del sistema.
- Notificaciones del sistema operativo.
- Drag & drop de archivos para ingestar.
- Búsqueda global con atajo de teclado (similar a Spotlight/Alfred).

---

## Ideas en exploración

### 1. Tray app (barra de menú)

Una app mínima en la barra de menú que:
- Muestra si el worker está corriendo.
- Permite búsqueda rápida sin abrir el browser.
- Botón para abrir la UI completa.

**Tecnología candidata**: Tauri (Rust + WebView), Electron, o script AppleScript/PowerShell
para wrappear el proceso Node existente.

### 2. Búsqueda global

Atajo de teclado configurable (ej. `Cmd+Shift+M`) que abre un panel de búsqueda flotante,
similar a cómo funciona Raycast o Alfred.

### 3. Auto-ingest de archivos

Watcher de directorios configurados que ingesta automáticamente cuando detecta cambios,
similar a como funcionan los indexadores de búsqueda del sistema.

### 4. Sync entre máquinas

Dado que la DB es PostgreSQL, el sync natural sería apuntar a una instancia remota compartida.
Una UI para configurar el `DATABASE_URL` sin editar archivos sería útil.

### 5. Exportar / importar

- Export: volcar todas las memorias a JSONL o Markdown.
- Import: restaurar desde un export previo o migrar desde otra instancia.

---

## Restricciones conocidas

- El núcleo debe seguir siendo CLI + MCP para compatibilidad con agentes IA.
- La desktop app sería una capa encima, no un reemplazo.
- Dependencias nuevas deben ser opcionales (no aumentar el tamaño del paquete npm base).

---

## Estado

Sin trabajo activo en esta dirección. Las ideas se documentan aquí para no perderlas
y para evaluar demanda antes de invertir tiempo de desarrollo.

Si tienes interés en contribuir a alguna de estas funcionalidades, abre un issue en
https://github.com/cabupy/vector_memory_pg
