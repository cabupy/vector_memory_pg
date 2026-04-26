# Cookbook: Reglas de Seguridad

Documenta las reglas y restricciones de seguridad del proyecto para que
los agentes respeten las políticas establecidas.

## Qué guardar

- Variables de entorno que nunca deben commitearse.
- Patrones de datos que se consideran sensibles.
- Requisitos de autenticación y autorización.
- Restricciones de acceso a redes/servicios.

## Ejemplo

```javascript
save_memory({
  content: `Las API keys de producción solo existen en las variables de entorno del servidor.
    Nunca deben aparecer en código, logs ni en respuestas de la API.
    Patrón a detectar: sk-*, Bearer eyJ*, postgres://*:*@*.
    En vector-memory usar <private>...</private> para redactar antes de guardar.`,
  memory_type: "security",
  criticality: "critical",
  tags: ["api-keys", "secrets", "producción"],
  project: "mi-proyecto"
})
```

## Políticas de vector-memory

### @no-memory

Agrega `@no-memory` en cualquier parte del texto para que el fragmento
no sea guardado en la base de conocimiento:

```
Este token de test es sk-test-123 @no-memory
```

### \<private\>...\</private\>

Envuelve información sensible para que sea redactada como `[private]` antes de guardar:

```javascript
save_memory({
  content: "La DB de producción está en <private>db-prod.internal:5432</private> con user admin."
})
// Guardado como: "La DB de producción está en [private] con user admin."
```

### secret-mode en ingest

Al ingestar archivos con `vector-memory ingest`:

```bash
# block: rechaza el archivo si detecta secretos (default)
vector-memory ingest ./config.js --secret-mode block

# redact: redacta los secretos antes de guardar
vector-memory ingest ./config.js --secret-mode redact
```
