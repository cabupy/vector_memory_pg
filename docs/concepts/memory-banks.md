# Bancos De Memoria

Un **banco de memoria** es una colección nombrada de memorias asociada a un proyecto, equipo o dominio específico.
Permite organizar el conocimiento en espacios separados con metadata propia.

## Comandos

```bash
# Listar todos los bancos
vector-memory bank ls

# Crear un banco
vector-memory bank create mi-proyecto

# Ver estadísticas de un banco
vector-memory bank show mi-proyecto

# Listar documentos de un banco
vector-memory doc ls mi-proyecto

# Ingestar un archivo en un banco
vector-memory doc create mi-proyecto ./README.md

# Ver resumen compacto del banco
vector-memory manifest mi-proyecto
```

## Cómo funciona

Los bancos de memoria usan la metadata existente (`organization`, `project`) para agrupar memorias.
La configuración de bancos se guarda en `~/.vector-memory-banks.json`.

Al ingestar un documento con `doc create`, se sobreescriben temporalmente las variables de entorno
`MEMORY_ORGANIZATION` y `MEMORY_PROJECT` para que todas las memorias queden asociadas al banco.

## Manifest

El comando `manifest` genera un resumen compacto del banco con:
- Estadísticas generales (total memorias, por tipo, por criticidad)
- Tags más frecuentes
- Memorias verificadas recientemente

Es útil para dar contexto a un agente al inicio de sesión sin saturar el context window.

```bash
vector-memory manifest mi-proyecto
```

## Casos de uso

- **Por repositorio**: un banco por repo para conocimiento técnico específico.
- **Por equipo**: un banco compartido con decisiones de arquitectura del equipo.
- **Por cliente**: separar conocimiento de distintos proyectos sin mezclarlos.
- **Por dominio**: infrastructure, frontend, backend, seguridad, etc.
